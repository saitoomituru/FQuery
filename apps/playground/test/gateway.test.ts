import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { explicitSource } from "@fquery/config";
import { createLiteralDecompositionFam } from "@fquery/fam-core";
import { GeminiFamPlugin } from "@fquery/plugin-gemini";
import { decomposeText } from "../server/gateway.js";

const repoRoot = resolve(process.cwd(), "../..");

describe("Playground gateway", () => {
  it("fixture routeを共通Q envelopeで返す", async () => {
    const response = await decomposeText({ provider: "fixture", model: "mock-fam-transformer", source: "自然言語テスト" }, { repoRoot });
    expect(response.result).toMatchObject({ transport_status: "succeeded", plugin_status: "resolved", value: { schema_version: "fam.json/0.1.0-draft", ψ: { source_text: "自然言語テスト" }, Q: { unknown_is_absence: false } } });
    expect(JSON.stringify(response)).toContain('"provider":"fixture"');
    expect(response.access_map).toMatchObject({ kind: "access-map", Q: { authority_ref: "authority://fquery/test-fixture-only" } });
  });

  it("ref FAM欠落をgatewayからGemini adapterとCoreまで結合してprofile補正する", async () => {
    const candidate = structuredClone(createLiteralDecompositionFam("雨が降っている。傘を持って出かける。", "q://provider/ref-fam"));
    (candidate as { kind: string }).kind = "provider-candidate";
    delete (candidate.Q as Record<string, unknown>).unknown_is_absence;
    for (const unit of (candidate.λ as { output_units: Array<{ Q: Record<string, unknown> }> }).output_units) delete unit.Q.unknown_is_absence;
    const generate = vi.fn(async () => ({ text: JSON.stringify(candidate), requestId: "gateway-integration-fixture" }));
    const response = await decomposeText(
      { provider: "gemini", model: "gemini-integration-fixture", source: "雨が降っている。傘を持って出かける。" },
      {
        repoRoot,
        resolverFactory: () => new GeminiFamPlugin({
          model: "gemini-integration-fixture",
          credentialName: "gemini-local",
          credentialSources: [explicitSource([{ name: "gemini-local", key: "not-a-real-key" }])],
          generate,
        }),
      },
    );
    expect(generate).toHaveBeenCalledOnce();
    expect(response.result).toMatchObject({ transport_status: "succeeded", control_status: "result", value: { Q: { unknown_is_absence: false } } });
    expect(response.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventType: "plugin-call-end", detail: expect.objectContaining({ normalization: expect.objectContaining({ repairedPaths: expect.arrayContaining(["$.kind", "$.Q.unknown_is_absence", "$.λ.output_units[0].Q.unknown_is_absence"]) }) }) }),
    ]));
  });

  it("空sourceを拒否する", async () => {
    await expect(decomposeText({ provider: "fixture", model: "mock-fam-transformer", source: "" }, { repoRoot })).rejects.toThrow("invalid-source");
  });

  it("初期module失敗時も黒画面にせず起動状態と再読込導線を残す", () => {
    const html = readFileSync(resolve(repoRoot, "apps/playground/index.html"), "utf8");
    expect(html).toContain("id=\"fquery-boot-status\"");
    expect(html).toContain("import(\"/src/main.tsx\").catch");
    expect(html).toContain("FQuery起動失敗");
    expect(html).toContain("再読込");
  });
});
