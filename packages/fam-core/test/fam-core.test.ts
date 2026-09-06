import { describe, expect, it } from "vitest";
import {
  readFamJson,
  createLiteralDecompositionFam,
  serializeFamJson,
  validateFamJson,
  validateFamDecomposition,
  writeUnmodifiedFamJson,
  type FamJsonRecord,
} from "../src/index.js";

const nested: FamJsonRecord = {
  schema_version: "fam.json/0.1.0-draft",
  fam_id: "fam://test/rain",
  revision_id: "rev://test/rain/1",
  kind: "wisdom",
  title: "雨と傘",
  index_subjects: ["雨", "傘"],
  ψ: { source: "雨が降っている。", observation_status: "provided" },
  "∇φ": [{ gradient_type: "decomposition", source_mutation: false }],
  λ: {
    purpose: "観測と行動候補を分離して保持する",
    output_units: [
      {
        ψ: { observation: "雨が降っている。" },
        "∇φ": [{ relation: "observed-as" }],
        λ: { manifestation: "降雨観測" },
        Q: { fact_scope: "provided-text", certainty: "stated" },
        future_extension: { retained: true },
      },
      {
        ψ: { action: "傘を持って出かける。" },
        "∇φ": [{ relation: "candidate-action" }],
        λ: { manifestation: "外出時の傘携行" },
        Q: { fact_scope: "provided-text", certainty: "stated" },
      },
    ],
  },
  Q: {
    observer_ref: "observer://user-input",
    registry_ref: "registry://fquery/fam-core",
    unknowns: ["降水量の正確な数値"],
    unknown_is_absence: false,
  },
  pointers: [],
  provenance: { claim_scope: "USER_PROVIDED_TEXT", source_refs: ["input://source"] },
  future_root_field: { retained: true },
};

describe("FAM JSON Core", () => {
  it("ψ / ∇φ / λ / Qとnested FAMを再帰検証する", () => {
    const result = validateFamJson(nested);
    expect(result.valid).toBe(true);
    expect(result.nodePaths).toEqual(["$", "$.λ.output_units[0]", "$.λ.output_units[1]"]);
  });

  it("nested nodeの軸欠落を拒否する", () => {
    const invalid = structuredClone(nested) as unknown as Record<string, unknown>;
    const lambda = invalid.λ as { output_units: Record<string, unknown>[] };
    delete lambda.output_units[0]!.Q;
    expect(validateFamJson(invalid).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: "$.λ.output_units[0].Q", code: "axis-required" }),
    ]));
  });

  it("未知fieldと空白を含む原文をbyte同一でround-tripする", () => {
    const text = JSON.stringify(nested, null, 4);
    const document = readFamJson(text);
    expect(writeUnmodifiedFamJson(document)).toBe(text);
    expect(document.value.future_root_field).toEqual({ retained: true });
  });

  it("canonical serializationも再検証できる", () => {
    expect(readFamJson(serializeFamJson(nested)).value.fam_id).toBe("fam://test/rain");
  });

  it("literal fixtureを縦型・nested FAMとして生成する", () => {
    const value = createLiteralDecompositionFam("雨が降っている。傘を持つ。降水量は未確認。", "q://test/rain");
    const result = validateFamDecomposition(value);
    expect(result.valid).toBe(true);
    expect(result.nodePaths).toHaveLength(4);
    expect((value.λ as { output_units: FamJsonRecord[] }).output_units[0]).toHaveProperty("ψ");
    expect(value.Q.unknown_is_absence).toBe(false);
  });

  it("blocksだけの旧candidate形式をFAMとして受理しない", () => {
    expect(validateFamDecomposition({
      schema_version: "fquery.candidate-fam/0.1.0-draft",
      transformation: "fam.decompose",
      blocks: [],
      unresolved: [],
    }).valid).toBe(false);
  });
});
