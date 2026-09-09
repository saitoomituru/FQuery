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
      revision_ref: "rev://fquery/test/basic-commons-access-mapper/2",
      resolved_before_provider: true,
      generation_constraint: null,
      post_validation: { appliedStages: ["post-validation"], validationScope: "fam-shape-classification-and-declared-topology-binding", oaeConstraintEvaluations: [] },
      post_validation_error: null,
      presentation_projection: { status: "provided-to-host", semantic_topology_status: "topology-not-declared", selected_branch_ref: null, branch_refs: [], selection_scope_ref: "scope://fquery/playground/presentation-only" },
    });
  });

  it("ref FAM欠落をgatewayからGemini adapterとCoreまで結合してprofile補正する", async () => {
    const candidate = structuredClone(createLiteralDecompositionFam("雨が降っている。傘を持って出かける。", "q://provider/ref-fam"));
    (candidate as { kind: string }).kind = "provider-candidate";
    delete (candidate.Q as Record<string, unknown>).unknown_is_absence;
    for (const unit of (candidate.λ as { output_units: Array<{ Q: Record<string, unknown> }> }).output_units) delete unit.Q.unknown_is_absence;
    const units = (candidate.λ as { output_units: Array<{ Q: { unit_ref: string } }> }).output_units;
    (candidate.Q as Record<string, unknown>).semantic_topology_branches = [{
      branch_ref: "branch://fquery/decomposition/primary",
      observer_ref: "observer://gateway/integration",
      relations: [{ from_unit_ref: units[0]!.Q.unit_ref, to_unit_ref: units[1]!.Q.unit_ref, axis: "mL", relation_kind: "causal", evidence_refs: [] }],
    }];
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
    expect(prompt.ref_profiles).toEqual([expect.objectContaining({ profileRef: "fam://fquery/test/basic-commons-access-mapper", revisionRef: "rev://fquery/test/basic-commons-access-mapper/2", value: expect.objectContaining({ kind: "access-map" }) })]);
    expect(prompt.ref_profiles[0]?.value).toMatchObject({ "∇φ": { semantic_topology_contract: { branches_pointer: "/Q/semantic_topology_branches" } } });
    expect(response.result).toMatchObject({ transport_status: "succeeded", control_status: "result", value: { Q: { unknown_is_absence: false } } });
    expect(response.ref_fam_receipt).toMatchObject({
      generation_constraint: { appliedStages: ["generation-constraint"] },
      post_validation: { appliedStages: ["post-validation"] },
      post_validation_error: null,
      presentation_projection: { profile_ref: "fam://fquery/test/basic-commons-access-mapper", revision_ref: "rev://fquery/test/basic-commons-access-mapper/2", semantic_topology_status: "selected", selected_branch_ref: "branch://fquery/decomposition/primary", branch_refs: ["branch://fquery/decomposition/primary"] },
    });
    expect(response.events).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventType: "plugin-call-end", detail: expect.objectContaining({ normalization: expect.objectContaining({ repairedPaths: expect.arrayContaining(["$.kind", "$.Q.unknown_is_absence", "$.λ.output_units[0].Q.unknown_is_absence"]) }) }) }),
    ]));
  });

  it("壊れたsemantic topologyをHTTP例外にせずcandidate保持Last Orderで返す", async () => {
    const candidate = structuredClone(createLiteralDecompositionFam("A。B。C。", "q://provider/invalid-topology"));
    const units = (candidate.λ as { output_units: Array<{ Q: { unit_ref: string } }> }).output_units;
    (candidate.Q as Record<string, unknown>).semantic_topology_branches = [{
      branch_ref: "branch://fquery/decomposition/primary",
      observer_ref: "observer://gateway/integration",
      relations: [
        { from_unit_ref: units[0]!.Q.unit_ref, to_unit_ref: units[2]!.Q.unit_ref, axis: "mL", relation_kind: "parent-child", evidence_refs: [] },
        { from_unit_ref: units[1]!.Q.unit_ref, to_unit_ref: units[2]!.Q.unit_ref, axis: "mL", relation_kind: "parent-child", evidence_refs: [] },
      ],
    }];
    const response = await decomposeText(
      { provider: "fixture", model: "invalid-topology-fixture", source: "A。B。C。" },
      { repoRoot, resolverFactory: () => ({ async invoke() { return { pluginId: "plugin://test/invalid-topology", transportStatus: "succeeded", outputStatus: "accepted", value: candidate, evidenceRefs: [] }; } }) },
    );

    expect(response.result).toMatchObject({
      transport_status: "succeeded",
      control_status: "last-order",
      candidate: { fam_id: candidate.fam_id },
      last_order: { code: "FQUERY-REF-FAM-NONCONFORMANT", requested_next: "inspect-and-edit-semantic-topology-or-select-another-ref-fam" },
    });
    expect(response.result).not.toHaveProperty("value");
    expect(response.ref_fam_receipt).toMatchObject({ post_validation: null, post_validation_error: { code: "FQUERY-REF-FAM-NONCONFORMANT", reason: expect.stringContaining("semantic-topology-multiple-containment-parents") } });
    expect(response.events).toEqual(expect.arrayContaining([expect.objectContaining({ eventType: "semantic-check", status: "profile-rejected" })]));
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
