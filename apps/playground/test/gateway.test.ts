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
    expect(response.ref_fam_receipt).toMatchObject({
      profile_ref: "fam://fquery/test/basic-commons-access-mapper",
      revision_ref: "rev://fquery/test/basic-commons-access-mapper/1",
      resolved_before_provider: true,
      generation_constraint: null,
      post_validation: { appliedStages: ["post-validation"], validationScope: "fam-shape-and-classification-binding", oaeConstraintEvaluations: [] },
      presentation_projection: { status: "provided-to-host" },
    });
  });

  it("ref FAM欠落をgatewayからGemini adapterとCoreまで結合してprofile補正する", async () => {
    const candidate = structuredClone(createLiteralDecompositionFam("雨が降っている。傘を持って出かける。", "q://provider/ref-fam"));
    (candidate as { kind: string }).kind = "provider-candidate";
    delete (candidate.Q as Record<string, unknown>).unknown_is_absence;
    for (const unit of (candidate.λ as { output_units: Array<{ Q: Record<string, unknown> }> }).output_units) delete unit.Q.unknown_is_absence;
    const generate = vi.fn(async (_request: { readonly prompt: string }) => ({ text: JSON.stringify(candidate), requestId: "gateway-integration-fixture" }));
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
    const prompt = JSON.parse(generate.mock.calls[0]![0].prompt) as { ref_profiles: Array<Record<string, unknown>> };
    expect(prompt.ref_profiles).toEqual([expect.objectContaining({ profileRef: "fam://fquery/test/basic-commons-access-mapper", revisionRef: "rev://fquery/test/basic-commons-access-mapper/1", value: expect.objectContaining({ kind: "access-map" }) })]);
    expect(response.result).toMatchObject({ transport_status: "succeeded", control_status: "result", value: { Q: { unknown_is_absence: false } } });
    expect(response.ref_fam_receipt).toMatchObject({
      generation_constraint: { appliedStages: ["generation-constraint"] },
      post_validation: { appliedStages: ["post-validation"] },
      presentation_projection: { profile_ref: "fam://fquery/test/basic-commons-access-mapper", revision_ref: "rev://fquery/test/basic-commons-access-mapper/1" },
    });
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
