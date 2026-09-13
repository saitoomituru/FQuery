import type { CapabilityInvocation, CapabilityResult } from "@fquery/core";
import { createCliHarnessHandler, type CliDecodedResponse, type PluginHandler, type PluginManifest } from "@fquery/plugin-sdk";
import { NodeCliExecutor } from "./executor.js";

/**
 * @fam/ibd: IBD `experiments/season0/fquery_cli.py`(FamDocumentStore)へ
 * CLI harness経由でput/resolveを橋渡しするplugin。reference実装
 * (file-backed)のみを対象とし、本番backend adapter選定(IBD #3/#4の
 * User Gate)を代替しない。evidence/oae/module-graphは未接続。
 */

export const CAPABILITIES = ["ibd.put", "ibd.resolve"] as const;
export type IbdFamCapability = (typeof CAPABILITIES)[number];

export const ibdPluginManifest: PluginManifest = Object.freeze({
  schemaVersion: "fquery.plugin/0.1.0-draft",
  pluginId: "@fam/ibd",
  pluginVersion: "0.1.0-draft.0",
  capabilities: CAPABILITIES,
  accepts: ["application/json"],
  returns: ["application/json"],
  authority: { required: false, scopes: [] },
  sideEffect: "write",
  unknownPolicy: "retain",
  lastOrderPolicy: "return-envelope",
  implementation: { language: "python", runtime: "cli-harness" },
  famSupport: Object.freeze({
    schemaVersion: "fam.adapter-support/0.1.0-draft",
    level: 0,
    capabilityRefs: CAPABILITIES,
    observationSurfaces: ["cli-stdio"],
    limitations: [
      "reference-implementation-only(file-backed FamDocumentStore、本番backend adapter未接続)",
      "put/resolveのみ(evidence/oae/module-graphは未接続)",
    ],
  } as const),
});

export interface IbdPutInput {
  readonly document: Record<string, unknown>;
}

export interface IbdResolveInput {
  readonly famRef: string;
  readonly revisionPolicy: { readonly mode: "pinned" | "latest"; readonly revisionRef?: string };
}

export interface IbdPluginOptions {
  /** IBDリポジトリのroot(experiments/season0/fquery_cli.pyの親)。 */
  readonly ibdRoot: string;
  /** FamDocumentStoreのデータ保存先root。 */
  readonly storageRoot: string;
  readonly pythonCommand?: string;
  readonly timeoutMs?: number;
}

export interface IbdPlugin {
  readonly manifest: PluginManifest;
  readonly handler: PluginHandler;
}

export function createIbdPlugin(options: IbdPluginOptions): IbdPlugin {
  const pythonCommand = options.pythonCommand ?? "python3";
  const scriptPath = `${options.ibdRoot}/experiments/season0/fquery_cli.py`;
  const executor = new NodeCliExecutor({
    resolveCommand: () => ({ command: pythonCommand, args: [scriptPath] }),
  });

  const handler = createCliHarnessHandler(
    ibdPluginManifest,
    {
      commandRef: "ibd-fquery-cli",
      fixedArgs: [],
      harnessRef: "ibd-season0-fquery-cli/0.1.0-draft",
      providerRef: "ibd",
      runtimeRef: "python3",
      timeoutMs: options.timeoutMs ?? 10_000,
      encodeRequest: (request: CapabilityInvocation): string => {
        if (request.capability === "ibd.put") {
          const input = request.input as IbdPutInput;
          return JSON.stringify({ operation: "put", root: options.storageRoot, document: input.document });
        }
        if (request.capability === "ibd.resolve") {
          const input = request.input as IbdResolveInput;
          return JSON.stringify({
            operation: "resolve",
            root: options.storageRoot,
            fam_ref: input.famRef,
            revision_policy: { mode: input.revisionPolicy.mode, ...(input.revisionPolicy.revisionRef ? { revision_ref: input.revisionPolicy.revisionRef } : {}) },
          });
        }
        throw new TypeError(`unsupported-ibd-capability:${request.capability}`);
      },
      decodeResponse: (stdout: string): CliDecodedResponse => {
        const parsed = JSON.parse(stdout) as Record<string, unknown>;
        if (parsed.status !== "ok") return { value: parsed, outputStatus: "invalid" };
        return { value: parsed };
      },
    },
    executor,
  );

  return Object.freeze({ manifest: ibdPluginManifest, handler });
}

export type { CapabilityInvocation, CapabilityResult };
