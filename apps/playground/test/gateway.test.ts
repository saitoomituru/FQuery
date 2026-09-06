import { describe, expect, it } from "vitest";
import { decomposeText } from "../server/gateway.js";

describe("Playground gateway", () => {
  it("fixture routeを共通Q envelopeで返す", async () => {
    const response = await decomposeText({ provider: "fixture", model: "mock-fam-transformer", source: "自然言語テスト" }, { repoRoot: process.cwd() });
    expect(response.result).toMatchObject({ transport_status: "succeeded", plugin_status: "resolved", value: { schema_version: "fquery.candidate-fam/0.1.0-draft" } });
    expect(JSON.stringify(response)).toContain('"provider":"fixture"');
  });

  it("空sourceを拒否する", async () => {
    await expect(decomposeText({ provider: "fixture", model: "mock-fam-transformer", source: "" }, { repoRoot: process.cwd() })).rejects.toThrow("invalid-source");
  });
});
