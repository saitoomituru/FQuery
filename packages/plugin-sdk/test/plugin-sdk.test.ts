import { describe, expect, it } from "vitest";
import { evaluateQ, Q } from "@fquery/core";
import { PluginRegistry, type PluginManifest } from "../src/index.js";

const echoManifest: PluginManifest = {
  schemaVersion: "fquery.plugin/0.1.0-draft",
  pluginId: "plugin://test/echo",
  pluginVersion: "0.1.0",
  capabilities: ["echo"],
  accepts: ["application/json"],
  returns: ["application/json"],
  authority: { required: false, scopes: [] },
  sideEffect: "none",
  unknownPolicy: "retain",
  lastOrderPolicy: "return-envelope",
  implementation: { language: "typescript", runtime: "node" },
};

describe("PluginRegistry", () => {
  it("deterministicなcapabilityを解決する", async () => {
    const registry = new PluginRegistry();
    registry.register(echoManifest, ({ input }) => ({ value: input, transportStatus: "succeeded", evidenceRefs: ["evidence://test/echo"] }));
    const query = Q({ kind: "literal", value: "hello" }, { queryId: "q://test/echo", operations: [{ kind: "invoke", capability: "echo" }] });
    const result = await evaluateQ(query, { pluginResolver: registry });
    expect(result.pluginStatus).toBe("resolved");
    expect(result.transportStatus).toBe("succeeded");
    expect(result.lambdaStatus).toBe("not-evaluated");
  });

  it("重複capabilityを黙って上書きしない", () => {
    const registry = new PluginRegistry();
    registry.register(echoManifest, () => ({ transportStatus: "succeeded" }));
    expect(() => registry.register({ ...echoManifest, pluginId: "plugin://test/other" }, () => ({ transportStatus: "succeeded" }))).toThrow("capability-already-registered");
  });

  it("許可されていないnetwork side effectを拒否する", async () => {
    const registry = new PluginRegistry();
    registry.register({ ...echoManifest, pluginId: "plugin://test/network", capabilities: ["network"], sideEffect: "network" }, () => ({ transportStatus: "succeeded" }));
    const query = Q({ kind: "literal", value: null }, { queryId: "q://test/network", operations: [{ kind: "invoke", capability: "network" }] });
    const result = await evaluateQ(query, { pluginResolver: registry });
    expect(result.pluginStatus).toBe("rejected");
    expect(result.lastOrder?.code).toBe("FQUERY-PLUGIN-REJECTED");
  });
});
