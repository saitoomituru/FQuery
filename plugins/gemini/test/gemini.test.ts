import { describe, expect, it, vi } from "vitest";
import { explicitSource } from "@fquery/config";
import { evaluateQ, Q, type CoreEvent } from "@fquery/core";
import { createLiteralDecompositionFam } from "@fquery/fam-core";
import type { DecompositionRequest } from "@fquery/plugin-sdk";
import { discoverGeminiModels, GeminiFamPlugin, GeminiNlDecomposer } from "../src/index.js";

describe("GeminiFamPlugin", () => {
  it("fake clientで再帰FAMとmodel routeを返す", async () => {
    const generate = vi.fn(async () => ({ text: JSON.stringify(createLiteralDecompositionFam("source", "q://test/gemini")), requestId: "request-fixture" }));
    const plugin = new GeminiFamPlugin({ model: "gemini-2.5-flash", credentialName: "gemini-local", credentialSources: [explicitSource([{ name: "gemini-local", key: "not-a-real-key" }])], generate });
    const events: CoreEvent[] = [];
    const result = await evaluateQ(Q({ kind: "literal", value: { block: "source" } }, { queryId: "q://test/gemini", operations: [{ kind: "invoke", capability: "fam.decompose" }], policy: { sideEffect: "network" } }), { pluginResolver: plugin, emit: (event) => events.push(event) });
    expect(result.transportStatus).toBe("succeeded"); expect(result.lambdaStatus).toBe("not-evaluated"); expect(generate).toHaveBeenCalledOnce();
    expect(result.value).toMatchObject({ schema_version: "fam.json/0.1.0-draft", ψ: { source_text: "source" }, Q: { unknown_is_absence: false } });
    const callEnd = events.find((event) => event.eventType === "plugin-call-end");
    expect(callEnd?.detail).toMatchObject({ execution: { provider: "google", model: "gemini-2.5-flash", pluginVersion: "0.1.0-draft.0", credentialName: "gemini-local", requestId: "request-fixture" } });
    expect(JSON.stringify(events)).not.toContain("not-a-real-key");
  });
  it("revision固定refFAMをprovider promptとCore receiptへ通す", async () => {
    const generate = vi.fn(async () => ({ text: JSON.stringify(createLiteralDecompositionFam("雨。", "q://test/ref-profile")) }));
    const plugin = new GeminiFamPlugin({ model: "gemini-fixture", credentialName: "gemini-local", credentialSources: [explicitSource([{ name: "gemini-local", key: "not-a-real-key" }])], generate });
    const events: CoreEvent[] = [];
    await evaluateQ(Q({ kind: "literal", value: "雨。" }, { queryId: "q://test/ref-profile", operations: [{ kind: "invoke", capability: "fam.decompose" }], policy: { sideEffect: "network" } }), {
      pluginResolver: plugin,
      profileBindings: [{ profileRef: "fam://test/access-map", revisionRef: "rev://test/access-map/1", mediaType: "application/fam+json", roles: ["generation-constraint", "validation-ruler", "presentation-ruler"], value: { kind: "access-map" } }],
      emit: (event) => events.push(event),
    });
    const prompt = JSON.parse(generate.mock.calls[0]![0].prompt) as Record<string, unknown>;
    expect(prompt.ref_profiles).toEqual([expect.objectContaining({ profileRef: "fam://test/access-map", revisionRef: "rev://test/access-map/1", value: { kind: "access-map" } })]);
    expect(events.find((event) => event.eventType === "plugin-call-end")?.detail).toMatchObject({ profileReceipts: [{ profileRef: "fam://test/access-map", revisionRef: "rev://test/access-map/1", appliedStages: ["generation-constraint"] }] });
    expect(prompt).not.toHaveProperty("source_language_hint");
    expect(prompt).not.toHaveProperty("translation_target");
  });
  it("旧blocks形式をFAMとして受理しない", async () => {
    const generate = vi.fn(async () => ({ text: JSON.stringify({ schema_version: "fquery.candidate-fam/0.1.0-draft", blocks: [] }) }));
    const plugin = new GeminiFamPlugin({ model: "gemini-2.5-flash", credentialName: "gemini-local", credentialSources: [explicitSource([{ name: "gemini-local", key: "not-a-real-key" }])], generate });
    const result = await evaluateQ(Q({ kind: "literal", value: "source" }, { queryId: "q://test/invalid", operations: [{ kind: "invoke", capability: "fam.decompose" }], policy: { sideEffect: "network" } }), { pluginResolver: plugin });
    expect(result.transportStatus).toBe("succeeded");
    expect(result.controlStatus).toBe("last-order");
    expect(result.lastOrder?.code).toBe("FQUERY-PLUGIN-OUTPUT-INVALID");
  });
  it("validator違反を1回だけproviderへ返して全置換する", async () => {
    const generate = vi.fn()
      .mockResolvedValueOnce({ text: JSON.stringify({ schema_version: "fquery.candidate-fam/0.1.0-draft", blocks: [] }) })
      .mockResolvedValueOnce({ text: JSON.stringify(createLiteralDecompositionFam("雨が降る。", "q://test/repair")), requestId: "repair-request" });
    const plugin = new GeminiFamPlugin({ model: "gemini-2.5-flash", credentialName: "gemini-local", credentialSources: [explicitSource([{ name: "gemini-local", key: "not-a-real-key" }])], generate });
    const result = await evaluateQ(Q({ kind: "literal", value: "雨が降る。" }, { queryId: "q://test/repair", operations: [{ kind: "invoke", capability: "fam.decompose" }], policy: { sideEffect: "network" } }), { pluginResolver: plugin });
    expect(result.transportStatus).toBe("succeeded");
    expect(generate).toHaveBeenCalledTimes(2);
    expect(generate.mock.calls[1]?.[0].prompt).toContain("Validator findings");
  });
  it("profile所有のunknown非不存在宣言はproviderへ再送せず局所補正する", async () => {
    const candidate = structuredClone(createLiteralDecompositionFam("雨。傘。未知。", "q://test/invariant"));
    candidate.kind = "provider-candidate";
    const units = (candidate.λ as { output_units: Array<{ Q: Record<string, unknown> }> }).output_units;
    delete units[2]!.Q.unknown_is_absence;
    const generate = vi.fn(async () => ({ text: JSON.stringify(candidate) }));
    const plugin = new GeminiFamPlugin({ model: "gemini-2.5-flash", credentialName: "gemini-local", credentialSources: [explicitSource([{ name: "gemini-local", key: "not-a-real-key" }])], generate });
    const events: CoreEvent[] = [];
    const result = await evaluateQ(Q({ kind: "literal", value: "雨。傘。未知。" }, { queryId: "q://test/invariant", operations: [{ kind: "invoke", capability: "fam.decompose" }], policy: { sideEffect: "network" } }), { pluginResolver: plugin, emit: (event) => events.push(event) });
    expect(result.transportStatus).toBe("succeeded");
    expect(generate).toHaveBeenCalledOnce();
    expect(events.find((event) => event.eventType === "plugin-call-end")?.detail).toMatchObject({ normalization: { profileRef: "profile://fquery/decomposition-invariants@0.1.0-draft", repairedPaths: ["$.kind", "$.λ.output_units[2].Q.unknown_is_absence"] } });
  });
  it("credentialなしをnetwork callせずLast Orderへ接続する", async () => {
    const generate = vi.fn(); const plugin = new GeminiFamPlugin({ model: "gemini-2.5-flash", credentialName: "missing", credentialSources: [], generate });
    const result = await evaluateQ(Q({ kind: "literal", value: null }, { queryId: "q://test/missing", operations: [{ kind: "invoke", capability: "fam.project" }], policy: { sideEffect: "network" } }), { pluginResolver: plugin });
    expect(result.controlStatus).toBe("last-order"); expect(result.reason).toContain("credential-not-found"); expect(generate).not.toHaveBeenCalled();
  });
  it("network許可なしではcredentialやtransportへ進まない", async () => {
    const generate = vi.fn(); const plugin = new GeminiFamPlugin({ model: "gemini-2.5-flash", credentialName: "gemini-local", credentialSources: [explicitSource([{ name: "gemini-local", key: "not-a-real-key" }])], generate });
    const result = await evaluateQ(Q({ kind: "literal", value: "source" }, { queryId: "q://test/deny", operations: [{ kind: "invoke", capability: "fam.decompose" }] }), { pluginResolver: plugin });
    expect(result.pluginStatus).toBe("rejected"); expect(generate).not.toHaveBeenCalled();
  });
  it("Q deadlineのcancel signalをgenerateへ渡す", async () => {
    const generate = vi.fn(async (request: { signal?: AbortSignal }) => {
      expect(request.signal).toBeInstanceOf(AbortSignal);
      return { text: JSON.stringify(createLiteralDecompositionFam("source", "q://test/signal")) };
    });
    const plugin = new GeminiFamPlugin({ model: "gemini-2.5-flash", credentialName: "gemini-local", credentialSources: [explicitSource([{ name: "gemini-local", key: "not-a-real-key" }])], generate });
    await evaluateQ(Q({ kind: "literal", value: "source" }, { queryId: "q://test/signal", operations: [{ kind: "invoke", capability: "fam.decompose" }], policy: { sideEffect: "network" } }), { pluginResolver: plugin });
    expect(generate).toHaveBeenCalledOnce();
  });
  it("provider errorへcredentialを露出しない", async () => {
    const generate = vi.fn(async () => { throw new Error("x-goog-api-key: not-a-real-key"); });
    const plugin = new GeminiFamPlugin({ model: "gemini-2.5-flash", credentialName: "gemini-local", credentialSources: [explicitSource([{ name: "gemini-local", key: "not-a-real-key" }])], generate });
    const result = await evaluateQ(Q({ kind: "literal", value: "source" }, { queryId: "q://test/redact", operations: [{ kind: "invoke", capability: "fam.decompose" }], policy: { sideEffect: "network" } }), { pluginResolver: plugin });
    expect(result.reason).toContain("[REDACTED]");
    expect(result.reason).not.toContain("not-a-real-key");
  });
  it("model catalogをprovider adapter境界から取得する", async () => {
    const listModels = vi.fn(async () => [{ name: "gemini-test-a" }, { name: "gemini-test-b" }]);
    await expect(discoverGeminiModels("not-a-real-key", listModels)).resolves.toEqual([{ name: "gemini-test-a" }, { name: "gemini-test-b" }]);
    expect(listModels).toHaveBeenCalledWith("not-a-real-key");
  });

  it("GeminiをΨ.NL Decomposer SPIとして利用する", async () => {
    const request: DecompositionRequest = { requestId: "request://gemini/spi", queryRef: "q://test/gemini-spi", profile: "nl", observation: { sourceRef: "input://gemini", mediaType: "text/plain", payload: "雨が降る。" } };
    const generate = vi.fn(async () => ({ text: JSON.stringify(createLiteralDecompositionFam("雨が降る。", request.queryRef)) }));
    const decomposer = new GeminiNlDecomposer({ model: "gemini-fixture", credentialName: "gemini-local", credentialSources: [explicitSource([{ name: "gemini-local", key: "not-a-real-key" }])], generate });
    const outcome = await decomposer.decompose(request);
    expect(outcome.status).toBe("resolved");
    expect(outcome.receipt).toMatchObject({ implementationRef: "decomposer://fquery/gemini-nl", provider: "google", model: "gemini-fixture", validationStatus: "accepted" });
  });
});
