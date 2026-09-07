import { describe, expect, it } from "vitest";
import { createLiteralDecompositionFam, readFamJson, serializeFamJson, validateFamDecomposition } from "@fquery/fam-core";
import { FamRevisionStore, replaceFamUnit } from "../src/index.js";

describe("stable unit local replacement", () => {
  const createDocument = () => readFamJson(serializeFamJson(createLiteralDecompositionFam(
    "雨が降っている。傘を持って出かける。ただし降水量は未確認である。",
    "q://issue-35/tc1",
  )));

  it("第3unitだけをUser overrideへ置換し他unitのidentityと内容を保持する", () => {
    const original = createDocument();
    const units = (original.value.λ as { output_units: Array<{ Q: { unit_ref: string }; λ: { manifestation: string } }> }).output_units;
    const beforeFirst = units[0];
    const beforeSecond = units[1];
    const targetRef = units[2]!.Q.unit_ref;
    const result = replaceFamUnit(original, {
      operationId: "edit://issue-35/tc1/1",
      unitRef: targetRef,
      baseParentRevisionId: original.value.revision_id,
      resultParentRevisionId: "rev://issue-35/tc1/2",
      resultUnitRevisionRef: `${targetRef}/revision/2`,
      replacementText: "降水確率は70%である。",
      claimKind: "world-fact",
      overrideSourceRef: "input://user/precipitation-probability",
      overrideObserverRef: "observer://user/issue-35",
    });
    expect(result.decision.status).toBe("accepted");
    const after = (result.decision.document.value.λ as { output_units: Array<{ Q: Record<string, unknown>; λ: { manifestation: string } }> }).output_units;
    expect(after[0]).toEqual(beforeFirst);
    expect(after[1]).toEqual(beforeSecond);
    expect(after[2]).toMatchObject({
      λ: { manifestation: "降水確率は70%である。" },
      Q: { unit_ref: targetRef, claim_kind: "world-fact", edit_origin: "user-override", replaces_source_expression: "ただし降水量は未確認である。", unknown_is_absence: false },
    });
    expect(validateFamDecomposition(result.decision.document.value).valid).toBe(true);
    expect(result.decision.receipt).toMatchObject({ beforeSha256: expect.stringMatching(/^[0-9a-f]{64}$/), afterSha256: expect.stringMatching(/^[0-9a-f]{64}$/), sourceMutation: false });
  });

  it("旧revisionと新revisionを別々に参照できる", () => {
    const original = createDocument();
    const targetRef = ((original.value.λ as { output_units: Array<{ Q: { unit_ref: string } }> }).output_units[2]!).Q.unit_ref;
    const result = replaceFamUnit(original, {
      operationId: "edit://issue-35/store/1", unitRef: targetRef,
      baseParentRevisionId: original.value.revision_id, resultParentRevisionId: "rev://issue-35/store/2", resultUnitRevisionRef: `${targetRef}/revision/2`,
      replacementText: "降水確率は70%である。", claimKind: "world-fact", overrideSourceRef: "input://user/70", overrideObserverRef: "observer://user",
    });
    const store = new FamRevisionStore();
    store.append(original);
    store.appendDecision(result.decision);
    expect(store.revisions(original.value.fam_id)).toEqual([original.value.revision_id, "rev://issue-35/store/2"]);
    expect(store.get(original.value.fam_id, original.value.revision_id)?.value).toBe(original.value);
  });
});
