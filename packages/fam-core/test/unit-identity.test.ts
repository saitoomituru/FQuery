import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createLiteralDecompositionFam, normalizeDecompositionProfileInvariants, projectDecompositionUnits, readAccessMapProfile, readFamJson, stampDecompositionUnitIdentity, validateFamDecomposition } from "../src/index.js";

const accessMap = readAccessMapProfile(readFamJson(readFileSync(new URL("../../../fixtures/test-cases/basic-commons-access-mapper/access-map.fam.json", import.meta.url), "utf8")).value);

describe("decomposition unit identity", () => {
  it("literal分解へstable unit refとparent revisionを付与する", () => {
    const fam = createLiteralDecompositionFam("雨。傘。未知。", "q://test/identity");
    const units = projectDecompositionUnits(fam, accessMap);
    expect(units.map((unit) => unit.unitRef)).toEqual([
      "q://test/identity/fam/unit/1",
      "q://test/identity/fam/unit/2",
      "q://test/identity/fam/unit/3",
    ]);
    expect(units[0]).toMatchObject({ parentFamRef: fam.fam_id, parentRevisionRef: fam.revision_id, order: 0, classification: { status: "mapped", sourceClaimKind: "unknown" } });
  });

  it("provider由来unitの既存identityを上書きしない", () => {
    const fam = structuredClone(createLiteralDecompositionFam("雨。", "q://test/provider"));
    const unit = (fam.λ as { output_units: Array<{ Q: Record<string, unknown> }> }).output_units[0]!;
    unit.Q.unit_ref = "fam://provider/stable-unit";
    expect(projectDecompositionUnits(stampDecompositionUnitIdentity(fam), accessMap)[0]?.unitRef).toBe("fam://provider/stable-unit");
  });

  it("重複unit refをrejectする", () => {
    const fam = structuredClone(createLiteralDecompositionFam("雨。傘。", "q://test/duplicate"));
    const units = (fam.λ as { output_units: Array<{ Q: Record<string, unknown> }> }).output_units;
    units[1]!.Q.unit_ref = units[0]!.Q.unit_ref;
    expect(() => projectDecompositionUnits(fam, accessMap)).toThrow("decomposition-unit-ref-duplicate");
  });

  it("provider候補へidentityとUNKNOWN非不存在宣言だけを補正してreceiptを返す", () => {
    const fam = structuredClone(createLiteralDecompositionFam("雨。傘。", "q://test/normalize"));
    const units = (fam.λ as { output_units: Array<{ Q: Record<string, unknown> }> }).output_units;
    delete units[0]!.Q.unit_ref;
    delete units[0]!.Q.unit_revision_ref;
    delete units[1]!.Q.unknown_is_absence;
    const original = structuredClone(fam);
    const normalized = normalizeDecompositionProfileInvariants(fam);
    expect(validateFamDecomposition(normalized.value).valid).toBe(true);
    expect((normalized.value.λ as { output_units: Array<{ Q: Record<string, unknown> }> }).output_units[1]!.Q.unknown_is_absence).toBe(false);
    expect(normalized.repairedPaths).toEqual([
      "$.λ.output_units[0].Q.unit_ref",
      "$.λ.output_units[0].Q.unit_revision_ref",
      "$.λ.output_units[1].Q.unknown_is_absence",
    ]);
    expect(fam).toEqual(original);
  });
});
