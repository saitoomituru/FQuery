import type { CapabilityInvocation, CapabilityResult, PluginResolver, QueryPolicy } from "@fquery/core";

export { ManualNlDecomposer, validateDecomposerCandidate } from "./decomposer.js";
export type * from "./decomposer.js";

export interface PluginManifest {
  readonly schemaVersion: "fquery.plugin/0.1.0-draft";
  readonly pluginId: string;
  readonly pluginVersion: string;
  readonly capabilities: readonly string[];
  readonly accepts: readonly string[];
  readonly returns: readonly string[];
  readonly authority: { readonly required: boolean; readonly scopes: readonly string[] };
  readonly sideEffect: Exclude<QueryPolicy["sideEffect"], "deny">;
  readonly unknownPolicy: "retain";
  readonly lastOrderPolicy: "return-envelope";
  readonly implementation: { readonly language: string; readonly runtime: string };
}

export type PluginHandler = (request: CapabilityInvocation) => Promise<Omit<CapabilityResult, "pluginId">> | Omit<CapabilityResult, "pluginId">;

interface Registration {
  readonly manifest: PluginManifest;
  readonly handler: PluginHandler;
}

export class PluginRegistry implements PluginResolver {
  readonly #byCapability = new Map<string, Registration>();

  register(manifest: PluginManifest, handler: PluginHandler): void {
    validateManifest(manifest);
    for (const capability of manifest.capabilities) {
      const existing = this.#byCapability.get(capability);
      if (existing) throw new Error(`capability-already-registered:${capability}:${existing.manifest.pluginId}`);
    }
    const registration = Object.freeze({ manifest: Object.freeze(manifest), handler });
    for (const capability of manifest.capabilities) this.#byCapability.set(capability, registration);
  }

  manifestFor(capability: string): PluginManifest | undefined {
    return this.#byCapability.get(capability)?.manifest;
  }

  async invoke(request: CapabilityInvocation): Promise<CapabilityResult | undefined> {
    const registration = this.#byCapability.get(request.capability);
    if (!registration) return undefined;
    if (!allowsSideEffect(request.sideEffect, registration.manifest.sideEffect)) {
      return { pluginId: registration.manifest.pluginId, pluginStatus: "rejected", transportStatus: "failed", reason: `side-effect-not-authorized:${registration.manifest.sideEffect}` };
    }
    if (registration.manifest.authority.required && registration.manifest.authority.scopes.length > 0) {
      return { pluginId: registration.manifest.pluginId, pluginStatus: "rejected", transportStatus: "failed", reason: `authority-required:${registration.manifest.authority.scopes.join(",")}` };
    }
    const result = await registration.handler(request);
    return { ...result, pluginId: registration.manifest.pluginId, pluginStatus: result.pluginStatus ?? "resolved" };
  }
}

export function allowsSideEffect(allowed: QueryPolicy["sideEffect"], required: Exclude<QueryPolicy["sideEffect"], "deny">): boolean {
  const matrix: Readonly<Record<QueryPolicy["sideEffect"], readonly Exclude<QueryPolicy["sideEffect"], "deny">[]>> = {
    deny: ["none"],
    none: ["none"],
    read: ["none", "read"],
    write: ["none", "read", "write"],
    network: ["none", "network"],
    physical: ["none", "physical"],
  };
  return matrix[allowed].includes(required);
}

function validateManifest(manifest: PluginManifest): void {
  if (manifest.schemaVersion !== "fquery.plugin/0.1.0-draft") throw new TypeError("unsupported plugin schemaVersion");
  if (!manifest.pluginId) throw new TypeError("pluginId is required");
  if (manifest.capabilities.length === 0) throw new TypeError("at least one capability is required");
  if (new Set(manifest.capabilities).size !== manifest.capabilities.length) throw new TypeError("duplicate capability in manifest");
}
