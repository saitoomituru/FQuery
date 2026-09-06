import { describe, expect, it, vi } from "vitest";
import { explicitSource } from "@fquery/config";
import { evaluateQ, Q, type CoreEvent } from "@fquery/core";
import { GeminiFamPlugin } from "../src/index.js";

describe("GeminiFamPlugin", () => {
  it("fake clientでcandidate FAMとmodel routeを返す", async () => {
    const generate = vi.fn(async () => ({ text: JSON.stringify({ schema_version: "fquery.candidate-fam/0.1.0-draft", transformation: "fam.decompose", blocks: [{ block_id: "b1", content: "part", source_refs: ["fam://source"] }], unresolved: [] }), requestId: "request-fixture" }));
    const plugin = new GeminiFamPlugin({ model: "gemini-2.5-flash", credentialName: "gemini-local", credentialSources: [explicitSource([{ name: "gemini-local", key: "not-a-real-key" }])], generate });
    const events: CoreEvent[] = [];
    const result = await evaluateQ(Q({ kind: "literal", value: { block: "source" } }, { queryId: "q://test/gemini", operations: [{ kind: "invoke", capability: "fam.decompose" }] }), { pluginResolver: plugin, emit: (event) => events.push(event) });
    expect(result.transportStatus).toBe("succeeded"); expect(result.lambdaStatus).toBe("not-evaluated"); expect(generate).toHaveBeenCalledOnce();
    const callEnd = events.find((event) => event.eventType === "plugin-call-end");
    expect(callEnd?.detail).toMatchObject({ execution: { provider: "google", model: "gemini-2.5-flash", credentialName: "gemini-local", requestId: "request-fixture" } });
    expect(JSON.stringify(events)).not.toContain("not-a-real-key");
  });
  it("credentialなしをnetwork callせずLast Orderへ接続する", async () => {
    const generate = vi.fn(); const plugin = new GeminiFamPlugin({ model: "gemini-2.5-flash", credentialName: "missing", credentialSources: [], generate });
    const result = await evaluateQ(Q({ kind: "literal", value: null }, { queryId: "q://test/missing", operations: [{ kind: "invoke", capability: "fam.project" }] }), { pluginResolver: plugin });
    expect(result.controlStatus).toBe("last-order"); expect(result.reason).toContain("credential-not-found"); expect(generate).not.toHaveBeenCalled();
  });
});
