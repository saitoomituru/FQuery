import { spawn } from "node:child_process";
import type { CliHarnessExecutionReceipt, CliHarnessExecutionRequest, CliHarnessExecutor } from "@fquery/plugin-sdk";

export interface ResolvedCommand {
  readonly command: string;
  readonly args: readonly string[];
}

export interface NodeCliExecutorOptions {
  /** Host側command registry相当。commandRefから実行可能fileと固定argsを解決する。 */
  readonly resolveCommand: (commandRef: string) => ResolvedCommand;
}

/**
 * node:child_processでCLIを実行するCliHarnessExecutor実装。
 * shellは経由しない(shell:falseの既定のまま呼ぶ)。
 */
export class NodeCliExecutor implements CliHarnessExecutor {
  readonly #resolveCommand: NodeCliExecutorOptions["resolveCommand"];

  constructor(options: NodeCliExecutorOptions) {
    this.#resolveCommand = options.resolveCommand;
  }

  execute(request: CliHarnessExecutionRequest): Promise<CliHarnessExecutionReceipt> {
    const { command, args: baseArgs } = this.#resolveCommand(request.commandRef);
    return new Promise((resolve) => {
      let settled = false;
      let stdout = "";
      let stderr = "";
      const child = spawn(command, [...baseArgs, ...request.args], { stdio: ["pipe", "pipe", "pipe"] });

      const finish = (receipt: CliHarnessExecutionReceipt) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(receipt);
      };

      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        finish({
          exitCode: null,
          stdout,
          stderrStatus: stderr.length > 0 ? "present-redacted" : "not-observed",
          termination: "timeout",
          evidenceRefs: [],
        });
      }, request.timeoutMs);

      request.signal?.addEventListener("abort", () => {
        child.kill("SIGKILL");
        finish({
          exitCode: null,
          stdout,
          stderrStatus: stderr.length > 0 ? "present-redacted" : "not-observed",
          termination: "cancelled",
          evidenceRefs: [],
        });
      });

      child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString("utf8"); });
      child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });

      child.on("error", () => {
        finish({ exitCode: null, stdout, stderrStatus: "not-observed", termination: "spawn-failed", evidenceRefs: [] });
      });

      child.on("close", (code, signal) => {
        finish({
          exitCode: code,
          stdout,
          stderrStatus: stderr.length > 0 ? "present-redacted" : "empty",
          termination: signal ? "signalled" : "exited",
          evidenceRefs: [],
        });
      });

      child.stdin.write(request.stdin);
      child.stdin.end();
    });
  }
}
