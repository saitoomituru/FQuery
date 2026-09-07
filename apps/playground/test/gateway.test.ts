import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { decomposeText } from "../server/gateway.js";

const repoRoot = resolve(process.cwd(), "../..");

describe("Playground gateway", () => {
  it("fixture routeを共通Q envelopeで返す", async () => {
    const response = await decomposeText({ provider: "fixture", model: "mock-fam-transformer", source: "自然言語テスト" }, { repoRoot });
    expect(response.result).toMatchObject({ transport_status: "succeeded", plugin_status: "resolved", value: { schema_version: "fam.json/0.1.0-draft", ψ: { source_text: "自然言語テスト" }, Q: { unknown_is_absence: false } } });
    expect(JSON.stringify(response)).toContain('"provider":"fixture"');
    expect(response.access_map).toMatchObject({ kind: "access-map", Q: { authority_ref: "authority://fquery/test-fixture-only" } });
  });

  it("空sourceを拒否する", async () => {
    await expect(decomposeText({ provider: "fixture", model: "mock-fam-transformer", source: "" }, { repoRoot })).rejects.toThrow("invalid-source");
  });
});
