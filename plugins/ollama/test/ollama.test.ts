import { describe, expect, it, vi } from "vitest";
import { evaluateQ, Q, type CoreEvent } from "@fquery/core";
import { createLiteralDecompositionFam } from "@fquery/fam-core";
import { discoverOllamaModels, OllamaFamPlugin } from "../src/index.js";

describe("OllamaFamPlugin", () => {
  it("fake transportで自然言語を再帰FAMへ分解する", async () => {
    const generate = vi.fn(async () => ({ text: JSON.stringify(createLiteralDecompositionFam("雨が降っているので傘を持つ", "q://test/ollama")) }));
    const plugin = new OllamaFamPlugin({ model: "qwen3:8b", generate });
    const events: CoreEvent[] = [];
    const result = await evaluateQ(Q({ kind: "literal", value: "雨が降っているので傘を持つ" }, { queryId: "q://test/ollama", operations: [{ kind: "invoke", capability: "fam.decompose" }], policy: { sideEffect: "network" } }), { pluginResolver: plugin, emit: (event) => events.push(event) });
    expect(result.transportStatus).toBe("succeeded");
    expect(result.value).toMatchObject({ schema_version: "fam.json/0.1.0-draft", Q: { unknown_is_absence: false } });
    expect(events.find((event) => event.eventType === "plugin-call-end")?.detail).toMatchObject({ execution: { provider: "ollama", model: "qwen3:8b", pluginVersion: "0.1.0-draft.0" } });
  });

  it("旧blocks形式をFAMとして受理しない", async () => {
    const generate = vi.fn(async () => ({ text: JSON.stringify({ schema_version: "fquery.candidate-fam/0.1.0-draft", blocks: [] }) }));
    const plugin = new OllamaFamPlugin({ model: "qwen3:8b", generate });
    const result = await evaluateQ(Q({ kind: "literal", value: "source" }, { queryId: "q://test/invalid", operations: [{ kind: "invoke", capability: "fam.decompose" }], policy: { sideEffect: "network" } }), { pluginResolver: plugin });
    expect(result.transportStatus).toBe("failed");
  });

  it("network許可なしではtransportを呼ばない", async () => {
    const generate = vi.fn();
    const plugin = new OllamaFamPlugin({ model: "qwen3:8b", generate });
    const result = await evaluateQ(Q({ kind: "literal", value: "source" }, { queryId: "q://test/deny", operations: [{ kind: "invoke", capability: "fam.decompose" }] }), { pluginResolver: plugin });
    expect(result.pluginStatus).toBe("rejected");
    expect(generate).not.toHaveBeenCalled();
  });

  it("tags APIから複数modelを発見する", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ models: [{ name: "qwen3:8b", size: 10, details: { family: "qwen3" } }, { name: "mistral:7b", details: { family: "llama" } }] }), { status: 200 }));
    await expect(discoverOllamaModels("http://localhost:11434/", fetcher)).resolves.toEqual([{ name: "qwen3:8b", size: 10, family: "qwen3" }, { name: "mistral:7b", family: "llama" }]);
  });
});
