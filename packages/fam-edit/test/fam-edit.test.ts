import { describe, expect, it } from "vitest";
import { readFamJson, validateFamDecomposition, writeUnmodifiedFamJson } from "@fquery/fam-core";
import { affectedChildrenForPatches, applyFamPatch, reviewParentPatchProposal } from "../src/index.js";

const source = `{
  "schema_version": "fam.json/0.1.0-draft",
  "fam_id": "fam://test/edit",
  "revision_id": "rev://test/edit/1",
  "kind": "wisdom",
  "title": "編集試験",
  "index_subjects": [],
  "ψ": {"source": "原文"},
  "∇φ": [],
  "λ": {"output_units": []},
  "Q": {"unknown_is_absence": false},
  "pointers": [],
  "provenance": {},
  "future_field": {"retained": true}
}`;

const clock = () => new Date("2026-09-07T06:00:00.000Z");

describe("FAM edit engine", () => {
  it("元revisionを変更せず未知fieldを保持した新revisionを生成する", () => {
    const original = readFamJson(source);
    const decision = applyFamPatch(original, {
      operationId: "edit://test/set",
      baseRevisionId: "rev://test/edit/1",
      resultRevisionId: "rev://test/edit/2",
      patches: [{ op: "set", path: "/Q/review_status", value: "draft" }],
    }, { clock });

    expect(decision.status).toBe("accepted");
    expect(decision.document.value).toMatchObject({
      revision_id: "rev://test/edit/2",
      Q: { review_status: "draft" },
      future_field: { retained: true },
    });
    expect(original.value.revision_id).toBe("rev://test/edit/1");
    expect(writeUnmodifiedFamJson(original)).toBe(source);
    expect(decision.receipt).toMatchObject({ status: "accepted", sourceMutation: false, losses: [] });
    expect(decision.receipt.beforeSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(decision.receipt.afterSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("arrayへのinsertとremoveを順序どおり適用する", () => {
    const decision = applyFamPatch(readFamJson(source), {
      operationId: "edit://test/array",
      baseRevisionId: "rev://test/edit/1",
      resultRevisionId: "rev://test/edit/2",
      patches: [
        { op: "insert", path: "/index_subjects", index: 0, value: "FAM" },
        { op: "insert", path: "/index_subjects", index: 1, value: "編集" },
        { op: "remove", path: "/index_subjects/0" },
      ],
    }, { clock });
    expect(decision.status).toBe("accepted");
    expect(decision.document.value.index_subjects).toEqual(["編集"]);
  });

  it("stale revisionをrejectし元documentを返す", () => {
    const original = readFamJson(source);
    const decision = applyFamPatch(original, {
      operationId: "edit://test/stale",
      baseRevisionId: "rev://test/edit/0",
      resultRevisionId: "rev://test/edit/2",
      patches: [{ op: "set", path: "/title", value: "変更" }],
    }, { clock });
    expect(decision).toMatchObject({ status: "rejected", document: original, receipt: { reason: "stale-base-revision", afterSha256: null } });
  });

  it("identity fieldの直接patchをrejectする", () => {
    const decision = applyFamPatch(readFamJson(source), {
      operationId: "edit://test/protected",
      baseRevisionId: "rev://test/edit/1",
      resultRevisionId: "rev://test/edit/2",
      patches: [{ op: "set", path: "/fam_id", value: "fam://other" }],
    }, { clock });
    expect(decision.receipt.reason).toBe("protected-field");
  });

  it("必須4軸を壊すpatchをvalidator findings付きでrejectする", () => {
    const decision = applyFamPatch(readFamJson(source), {
      operationId: "edit://test/invalid",
      baseRevisionId: "rev://test/edit/1",
      resultRevisionId: "rev://test/edit/2",
      patches: [{ op: "remove", path: "/Q" }],
    }, { clock });
    expect(decision.status).toBe("rejected");
    expect(decision.receipt.reason).toBe("fam-validation-failed");
    expect(decision.receipt.validationIssues).toContainEqual(expect.objectContaining({ path: "$.Q", code: "axis-required" }));
  });

  it("profile validatorを注入しCore以上の制約を保持する", () => {
    const decomposition = `{
      "schema_version":"fam.json/0.1.0-draft","fam_id":"fam://test/decomposition","revision_id":"rev://test/decomposition/1","kind":"decomposition","title":"雨。","title_language":"ja","index_subjects":[],
      "ψ":{"source_text":"雨。","source_ref":"input://source","source_language":"ja","observation_status":"provided"},
      "∇φ":[{"gradient_type":"decomposition","source_expression":"雨。","source_language":"ja"}],
      "λ":{"purpose":"source-decomposition","purpose_expression":"雨。","purpose_language":"ja","output_units":[{"ψ":{"source_text":"雨。","source_ref":"input://source","source_language":"ja","observation_status":"provided"},"∇φ":[{"gradient_type":"source-segmentation","source_expression":"雨。","source_language":"ja"}],"λ":{"manifestation":"雨。","manifestation_language":"ja","sub_splitters":[]},"Q":{"observer_ref":"observer://test","registry_ref":"registry://test","fact_scope_ref":"world://test","unknowns":[],"unknown_is_absence":false}}],"satisfaction_status":"not-evaluated"},
      "Q":{"observer_ref":"observer://test","registry_ref":"registry://test","fact_scope_ref":"world://test","unknowns":[],"unknown_is_absence":false,"semantic_status":"not-evaluated"},"pointers":[],"provenance":{}
    }`;
    const decision = applyFamPatch(readFamJson(decomposition), {
      operationId: "edit://test/profile",
      baseRevisionId: "rev://test/decomposition/1",
      resultRevisionId: "rev://test/decomposition/2",
      patches: [{ op: "set", path: "/λ/output_units/0/λ/manifestation", value: "Rain." }],
    }, { clock, validate: validateFamDecomposition });
    expect(decision.receipt.reason).toBe("fam-validation-failed");
    expect(decision.receipt.validationIssues).toContainEqual(expect.objectContaining({ code: "canonical-manifestation-required" }));
  });

  it("不正なpointerと存在しないremoveを区別する", () => {
    const original = readFamJson(source);
    const invalidPointer = applyFamPatch(original, {
      operationId: "edit://test/pointer",
      baseRevisionId: "rev://test/edit/1",
      resultRevisionId: "rev://test/edit/2",
      patches: [{ op: "set", path: "Q/value", value: true }],
    }, { clock });
    const missing = applyFamPatch(original, {
      operationId: "edit://test/missing",
      baseRevisionId: "rev://test/edit/1",
      resultRevisionId: "rev://test/edit/2",
      patches: [{ op: "remove", path: "/Q/missing" }],
    }, { clock });
    expect(invalidPointer.receipt.reason).toBe("invalid-json-pointer");
    expect(missing.receipt.reason).toBe("path-not-found");
  });

  it("parent patchはreview後だけ適用し影響childを再検証へ返す", () => {
    const parent = readFamJson(source);
    const proposal = {
      proposalId: "patch://test/parent/1",
      parentFamId: "fam://test/edit",
      parentRevisionId: "rev://test/edit/1",
      childResultRef: "fam://test/child-result",
      patches: [{ op: "set" as const, path: "/Q/review_status", value: "accepted" }],
      childDependencies: [
        { childRef: "fam://test/child/q", observedParentPaths: ["/Q"] },
        { childRef: "fam://test/child/psi", observedParentPaths: ["/ψ"] },
      ],
    };
    const result = reviewParentPatchProposal(parent, proposal, {
      reviewId: "review://test/1",
      reviewerRef: "observer://test/reviewer",
      action: "accept-patch",
      reason: "fixture-review-accepted",
      resultRevisionId: "rev://test/edit/2",
    }, { clock });
    expect(result.status).toBe("applied");
    expect(result.parentDocument.value.revision_id).toBe("rev://test/edit/2");
    expect(result.revalidateChildRefs).toEqual(["fam://test/child/q"]);
    expect(parent.value.revision_id).toBe("rev://test/edit/1");
  });

  it("forkやexternal test要求は元parentへ適用しない", () => {
    const parent = readFamJson(source);
    const result = reviewParentPatchProposal(parent, {
      proposalId: "patch://test/parent/fork",
      parentFamId: "fam://test/edit",
      parentRevisionId: "rev://test/edit/1",
      childResultRef: "fam://test/child-result",
      patches: [{ op: "set", path: "/title", value: "分岐候補" }],
      childDependencies: [],
    }, {
      reviewId: "review://test/fork",
      reviewerRef: "observer://test/reviewer",
      action: "fork-parent",
      reason: "source parentを維持する",
    }, { clock });
    expect(result).toMatchObject({ status: "not-applied", action: "fork-parent", sourceMutation: false, parentDocument: parent });
    expect(result).not.toHaveProperty("editDecision");
  });

  it("変更pathと依存pathをsegment境界で比較する", () => {
    expect(affectedChildrenForPatches(
      [{ op: "set", path: "/Q/a", value: true }],
      [{ childRef: "q", observedParentPaths: ["/Q"] }, { childRef: "similar", observedParentPaths: ["/QQ"] }],
    )).toEqual(["q"]);
  });
});
