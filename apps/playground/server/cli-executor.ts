import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { isAbsolute } from "node:path";
import type {
  CliHarnessExecutionReceipt,
  CliHarnessExecutionRequest,
  CliHarnessExecutor,
} from "@fquery/plugin-sdk";

/**
 * Hostが明示的に許可したCLI実行profile。
 * FAM候補やBrowser入力から実行file・args・cwd・envを組み立ててはならない。
 */
export interface RegisteredCliCommand {
  readonly executablePath: string;
  readonly args: readonly string[];
  readonly workingDirectory: string;
  readonly maxTimeoutMs: number;
  readonly maxInputBytes?: number;
  readonly maxStdoutBytes?: number;
  readonly maxStderrBytes?: number;
  readonly environment?: NodeJS.ProcessEnv;
}

export interface RegisteredCliExecutorOptions {
  readonly commands: Readonly<Record<string, RegisteredCliCommand>>;
  readonly createRequestId?: () => string;
}

const DEFAULT_MAX_INPUT_BYTES = 1_000_000;
const DEFAULT_MAX_STDOUT_BYTES = 4_000_000;
const DEFAULT_MAX_STDERR_BYTES = 256_000;

/**
 * shellを介さず、Host registryの完全一致profileだけを起動するLv1 executor。
 * stdoutはcandidate、stderrは本文を返さず有無だけをreceiptへ残す。
 */
export function createRegisteredCliExecutor(options: RegisteredCliExecutorOptions): CliHarnessExecutor {
  const commands = new Map(Object.entries(options.commands));
  for (const [commandRef, command] of commands) validateRegisteredCommand(commandRef, command);
  const createRequestId = options.createRequestId ?? randomUUID;

  return Object.freeze({
    async execute(request: CliHarnessExecutionRequest): Promise<CliHarnessExecutionReceipt> {
      const requestId = createRequestId();
      const command = commands.get(request.commandRef);
      if (!command) return rejectedReceipt(requestId, "cli-command-ref-not-registered");
      if (!sameArgs(request.args, command.args)) return rejectedReceipt(requestId, "cli-args-not-registered");
      if (request.timeoutMs > command.maxTimeoutMs) return rejectedReceipt(requestId, "cli-timeout-exceeds-profile");
      if (Buffer.byteLength(request.stdin, "utf8") > (command.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES)) {
        return rejectedReceipt(requestId, "cli-input-limit-exceeded");
      }
      if (request.signal?.aborted) return rejectedReceipt(requestId, "cli-cancelled-before-spawn", "cancelled");

      return executeRegisteredCommand(command, request, requestId);
    },
  });
}

function executeRegisteredCommand(
  command: RegisteredCliCommand,
  request: CliHarnessExecutionRequest,
  requestId: string,
): Promise<CliHarnessExecutionReceipt> {
  return new Promise((resolve) => {
    let settled = false;
    let forcedTermination: CliHarnessExecutionReceipt["termination"] | undefined;
    let failureReason: string | undefined;
    let stdoutBytes = 0;
    let stderrBytes = 0;
    const stdoutChunks: Buffer[] = [];

    const child = spawn(command.executablePath, [...command.args], {
      cwd: command.workingDirectory,
      env: command.environment,
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });

    const settle = (receipt: CliHarnessExecutionReceipt) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      request.signal?.removeEventListener("abort", cancel);
      resolve(Object.freeze(receipt));
    };
    const stop = (termination: CliHarnessExecutionReceipt["termination"], reason: string) => {
      if (forcedTermination) return;
      forcedTermination = termination;
      failureReason = reason;
      child.kill("SIGTERM");
    };
    const cancel = () => stop("cancelled", "cli-cancelled");
    const timeout = setTimeout(() => stop("timeout", "cli-timeout"), request.timeoutMs);
    request.signal?.addEventListener("abort", cancel, { once: true });

    child.stdout.on("data", (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      stdoutBytes += buffer.length;
      if (stdoutBytes > (command.maxStdoutBytes ?? DEFAULT_MAX_STDOUT_BYTES)) {
        stop("output-limit", "cli-stdout-limit-exceeded");
        return;
      }
      stdoutChunks.push(buffer);
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      stderrBytes += buffer.length;
      if (stderrBytes > (command.maxStderrBytes ?? DEFAULT_MAX_STDERR_BYTES)) stop("output-limit", "cli-stderr-limit-exceeded");
    });
    // 早期終了時のEPIPEを未処理例外にしない。終了状態はclose receiptで確定する。
    child.stdin.on("error", () => undefined);
    child.on("error", (error) => settle({
      exitCode: null,
      stdout: Buffer.concat(stdoutChunks).toString("utf8"),
      stderrStatus: stderrBytes > 0 ? "present-redacted" : "not-observed",
      termination: "spawn-failed",
      evidenceRefs: [],
      requestId,
      failureReason: `cli-spawn-failed:${error.name}`,
    }));
    child.on("close", (exitCode, signal) => settle({
      exitCode,
      stdout: Buffer.concat(stdoutChunks).toString("utf8"),
      stderrStatus: stderrBytes > 0 ? "present-redacted" : "empty",
      termination: forcedTermination ?? (signal ? "signalled" : "exited"),
      evidenceRefs: [],
      requestId,
      ...(failureReason ? { failureReason } : {}),
    }));
    child.stdin.end(request.stdin);
  });
}

function validateRegisteredCommand(commandRef: string, command: RegisteredCliCommand): void {
  if (!commandRef) throw new TypeError("CLI commandRef is required");
  if (!isAbsolute(command.executablePath)) throw new TypeError(`CLI executablePath must be absolute:${commandRef}`);
  if (!isAbsolute(command.workingDirectory)) throw new TypeError(`CLI workingDirectory must be absolute:${commandRef}`);
  if (!Number.isInteger(command.maxTimeoutMs) || command.maxTimeoutMs <= 0) throw new TypeError(`CLI maxTimeoutMs must be a positive integer:${commandRef}`);
  for (const limit of [command.maxInputBytes, command.maxStdoutBytes, command.maxStderrBytes]) {
    if (limit !== undefined && (!Number.isInteger(limit) || limit <= 0)) throw new TypeError(`CLI byte limit must be a positive integer:${commandRef}`);
  }
}

function sameArgs(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function rejectedReceipt(
  requestId: string,
  failureReason: string,
  termination: CliHarnessExecutionReceipt["termination"] = "spawn-failed",
): CliHarnessExecutionReceipt {
  return Object.freeze({
    exitCode: null,
    stdout: "",
    stderrStatus: "not-observed",
    termination,
    evidenceRefs: [],
    requestId,
    failureReason,
  });
}
