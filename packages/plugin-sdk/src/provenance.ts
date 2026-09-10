import type { AdapterProvenanceReceipt } from "@fquery/core";
import type { PluginManifest } from "./index.js";

export function createAdapterProvenance(
  manifest: PluginManifest,
  scope: {
    readonly providerRef?: string;
    readonly modelRef?: string;
    readonly runtimeRef?: string;
    readonly harnessRef?: string;
    readonly oaeRefs?: readonly string[];
  } = {},
): AdapterProvenanceReceipt {
  return Object.freeze({
    schemaVersion: "fam.adapter-provenance/0.1.0-draft",
    producerRef: manifest.pluginId,
    producerRevision: manifest.pluginVersion,
    adapterChain: Object.freeze([Object.freeze({
      adapterRef: manifest.pluginId,
      adapterRevision: manifest.pluginVersion,
      ...(scope.providerRef ? { providerRef: scope.providerRef } : {}),
      ...(scope.modelRef ? { modelRef: scope.modelRef } : {}),
      ...(scope.runtimeRef ? { runtimeRef: scope.runtimeRef } : {}),
      ...(scope.harnessRef ? { harnessRef: scope.harnessRef } : {}),
    })]),
    supportClaim: manifest.famSupport,
    oaeRefs: Object.freeze([...(scope.oaeRefs ?? [])]),
  });
}
