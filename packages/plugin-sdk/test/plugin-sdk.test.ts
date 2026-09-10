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
  famSupport: {
    schemaVersion: "fam.adapter-support/0.1.0-draft",
    level: 0,
    capabilityRefs: [],
    observationSurfaces: [],
    limitations: ["FAM transportを申告しないtest echo"],
  },
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

  it("自己申告LevelをCoreが認証・降格せずeventへ保存する", async () => {
    const registry = new PluginRegistry();
    registry.register({
      ...echoManifest,
      pluginId: "plugin://test/self-declared-native",
      capabilities: ["fam.native"],
      famSupport: {
        schemaVersion: "fam.adapter-support/0.1.0-draft",
        level: 5,
        capabilityRefs: ["fam.native"],
        observationSurfaces: ["test-declared-internal-bus"],
        limitations: ["third-party-oae-not-provided"],
      },
    }, ({ input }) => ({ value: input, transportStatus: "succeeded" }));
    const events: import("@fquery/core").CoreEvent[] = [];
    const query = Q({ kind: "literal", value: "candidate" }, { queryId: "q://test/support-claim", operations: [{ kind: "invoke", capability: "fam.native" }] });
    await evaluateQ(query, { pluginResolver: registry, emit: (event) => events.push(event) });
    expect(events.find((event) => event.eventType === "plugin-call-end")?.detail).toMatchObject({
      adapterProvenance: {
        producerRef: "plugin://test/self-declared-native",
        supportClaim: { level: 5, limitations: ["third-party-oae-not-provided"] },
        oaeRefs: [],
      },
    });
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
