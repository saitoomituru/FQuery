import type { CapabilityInvocation, CapabilityResult } from "@fquery/core";
import type { PluginHandler, PluginManifest } from "./index.js";
import { createAdapterProvenance } from "./provenance.js";

export interface CliHarnessAdapterConfig {
  /** Host側のcommand registryで解決する。shell文字列ではない。 */
  readonly commandRef: string;
  readonly fixedArgs: readonly string[];
  readonly harnessRef: string;
  readonly providerRef: string;
  readonly modelRef?: string;
  readonly runtimeRef?: string;
  readonly timeoutMs: number;
  readonly encodeRequest: (request: CapabilityInvocation) => string;
  readonly decodeResponse: (stdout: string, request: CapabilityInvocation) => CliDecodedResponse;
}

export interface CliHarnessExecutionRequest {
  readonly commandRef: string;
  readonly args: readonly string[];
  readonly stdin: string;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
}

/**
 * Hostが実processを実行した観測結果。stderr本文やcredentialはここへ載せず、
 * redaction済みreceiptをevidenceRefsから参照する。
 */
export interface CliHarnessExecutionReceipt {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderrStatus: "empty" | "present-redacted" | "not-observed";
  readonly termination: "exited" | "signalled" | "timeout" | "cancelled" | "output-limit" | "spawn-failed";
  readonly evidenceRefs: readonly string[];
  readonly requestId?: string;
  readonly failureReason?: string;
}

export interface CliHarnessExecutor {
  execute(request: CliHarnessExecutionRequest): Promise<CliHarnessExecutionReceipt>;
}

export interface CliDecodedResponse {
  readonly value: unknown;
  readonly outputStatus?: "accepted" | "profile-nonconformant" | "invalid";
  readonly evidenceRefs?: readonly string[];
  readonly oaeRefs?: readonly string[];
  readonly resolvedModelRef?: string;
}

/**
 * Codex / Claude / Grok等のCLIを同じABIへ接続するLv1向けhandler。
 * command実行権限、binary path、環境変数、sandboxはHost executorが所有する。
 */
export function createCliHarnessHandler(
  manifest: PluginManifest,
  config: CliHarnessAdapterConfig,
  executor: CliHarnessExecutor,
): PluginHandler {
  validateConfig(config);
  return async (request): Promise<Omit<CapabilityResult, "pluginId">> => {
    const executionRequest: CliHarnessExecutionRequest = {
      commandRef: config.commandRef,
      args: Object.freeze([...config.fixedArgs]),
      stdin: config.encodeRequest(request),
      timeoutMs: config.timeoutMs,
      ...(request.signal ? { signal: request.signal } : {}),
    };
    let receipt: CliHarnessExecutionReceipt;
    try {
      receipt = await executor.execute(executionRequest);
    } catch {
      return failureResult(manifest, config, "cli-executor-threw", {
        exitCode: null,
        stdout: "",
        stderrStatus: "not-observed",
        termination: "spawn-failed",
        evidenceRefs: [],
      });
    }

    if (receipt.termination !== "exited" || receipt.exitCode !== 0) {
      const reason = receipt.failureReason ?? `cli-${receipt.termination}${receipt.exitCode === null ? "" : `:${receipt.exitCode}`}`;
      return failureResult(manifest, config, reason, receipt);
    }

    try {
      const decoded = config.decodeResponse(receipt.stdout, request);
      const modelRef = decoded.resolvedModelRef ?? config.modelRef;
      return {
        value: decoded.value,
        transportStatus: "succeeded",
        outputStatus: decoded.outputStatus ?? "accepted",
        evidenceRefs: Object.freeze([...receipt.evidenceRefs, ...(decoded.evidenceRefs ?? [])]),
        adapterProvenance: createAdapterProvenance(manifest, {
          providerRef: config.providerRef,
          ...(modelRef ? { modelRef } : {}),
          ...(config.runtimeRef ? { runtimeRef: config.runtimeRef } : {}),
          harnessRef: config.harnessRef,
          ...(decoded.oaeRefs ? { oaeRefs: decoded.oaeRefs } : {}),
        }),
        execution: {
          provider: config.providerRef,
          model: modelRef ?? "unknown",
          pluginVersion: manifest.pluginVersion,
          ...(receipt.requestId ? { requestId: receipt.requestId } : {}),
          termination: receipt.termination,
          stderrStatus: receipt.stderrStatus,
        },
      };
    } catch {
      return {
        transportStatus: "succeeded",
        outputStatus: "invalid",
        candidate: receipt.stdout,
        reason: "cli-output-decode-failed",
        evidenceRefs: Object.freeze([...receipt.evidenceRefs]),
        adapterProvenance: createAdapterProvenance(manifest, {
          providerRef: config.providerRef,
          ...(config.modelRef ? { modelRef: config.modelRef } : {}),
          ...(config.runtimeRef ? { runtimeRef: config.runtimeRef } : {}),
          harnessRef: config.harnessRef,
        }),
      };
    }
  };
}

function failureResult(
  manifest: PluginManifest,
  config: CliHarnessAdapterConfig,
  reason: string,
  receipt: CliHarnessExecutionReceipt,
): Omit<CapabilityResult, "pluginId"> {
  return {
    transportStatus: "failed",
    outputStatus: "invalid",
    ...(receipt.stdout ? { candidate: receipt.stdout } : {}),
    reason,
    evidenceRefs: Object.freeze([...receipt.evidenceRefs]),
    adapterProvenance: createAdapterProvenance(manifest, {
      providerRef: config.providerRef,
      ...(config.modelRef ? { modelRef: config.modelRef } : {}),
      ...(config.runtimeRef ? { runtimeRef: config.runtimeRef } : {}),
      harnessRef: config.harnessRef,
    }),
    execution: {
      provider: config.providerRef,
      model: config.modelRef ?? "unknown",
      pluginVersion: manifest.pluginVersion,
      ...(receipt.requestId ? { requestId: receipt.requestId } : {}),
      termination: receipt.termination,
      stderrStatus: receipt.stderrStatus,
    },
  };
}

function validateConfig(config: CliHarnessAdapterConfig): void {
  if (!config.commandRef) throw new TypeError("CLI commandRef is required");
  if (!config.harnessRef) throw new TypeError("CLI harnessRef is required");
  if (!config.providerRef) throw new TypeError("CLI providerRef is required");
  if (!Number.isInteger(config.timeoutMs) || config.timeoutMs <= 0) throw new TypeError("CLI timeoutMs must be a positive integer");
}
