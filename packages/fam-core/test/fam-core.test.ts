import { describe, expect, it } from "vitest";
import {
  readFamJson,
  createLiteralDecompositionFam,
  FAM_JSON_RESPONSE_SCHEMA,
  inferSourceLanguage,
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

  it("入力言語を正本にし日本語固定へ寄せない", () => {
    const arabic = createLiteralDecompositionFam("المطر يهطل.", "q://test/ar");
    const hebrewScript = createLiteralDecompositionFam("גשם יורד.", "q://test/hebr");
    expect(arabic.ψ).toMatchObject({ source_text: "المطر يهطل.", source_language: "ar" });
    expect(arabic.title).toBe("المطر يهطل.");
    expect(hebrewScript.ψ).toMatchObject({ source_text: "גשם יורד.", source_language: "und-Hebr" });
    expect(inferSourceLanguage("雨が降る。")).toBe("ja");
  });

  it("翻訳をsub-splitter写本として誤差ledger付きで保持する", () => {
    const value = structuredClone(createLiteralDecompositionFam("雨が降る。", "q://test/translation")) as unknown as Record<string, unknown>;
    const units = (value.λ as { output_units: Array<Record<string, unknown>> }).output_units;
    (units[0]!.λ as { sub_splitters: unknown[] }).sub_splitters.push({
      ψ: { source_text: "雨が降る。", source_language: "ja", target_language: "en" },
      "∇φ": [{ gradient_type: "translation-copy" }],
      λ: { manifestation: "It is raining.", manifestation_language: "en" },
      Q: {
        copy_role: "translation-witness",
        source_node_ref: "q://test/translation#unit-0",
        unknowns: [],
        unknown_is_absence: false,
        translation_error: { status: "not-evaluated", metric_refs: [], measurements: [] },
      },
    });
    expect(validateFamDecomposition(value).valid).toBe(true);
  });

  it("Coreは表現のbyte一致を裁定せず構造を検証する", () => {
    const value = structuredClone(createLiteralDecompositionFam("雨が降る。", "q://test/replaced")) as unknown as Record<string, unknown>;
    const unit = (value.λ as { output_units: Array<Record<string, unknown>> }).output_units[0]!;
    (unit["∇φ"] as Array<Record<string, unknown>>)[0]!.source_expression = "It is raining.";
    (unit.λ as Record<string, unknown>).manifestation = "It is raining.";
    expect(validateFamDecomposition(value).valid).toBe(true);
  });

  it("Coreは入力内容のcoverageを裁定せず分類後shapeを検証する", () => {
    const value = structuredClone(createLiteralDecompositionFam("雨が降る。傘を持つ。", "q://test/coverage")) as unknown as Record<string, unknown>;
    (value.λ as { output_units: unknown[] }).output_units.pop();
    expect(validateFamDecomposition(value).valid).toBe(true);
  });

  it("日本語・英語・codeが混在するindexとprovenanceを保持する", () => {
    const value = structuredClone(createLiteralDecompositionFam("雨が降る。", "q://test/foreign")) as unknown as Record<string, unknown>;
    value.index_subjects = ["weather"];
    value.provenance = { source_separation: "Observed weather" };
    value.index_subjects = ["天気", "weather", "const rain = true;"];
    value.provenance = { source_separation: "観測 / Observed / if (rain) umbrella();" };
    expect(validateFamDecomposition(value).valid).toBe(true);
  });

  it("分類後shapeの必須source_expression欠落は拒否する", () => {
    const value = structuredClone(createLiteralDecompositionFam("雨が降る。", "q://test/shape")) as unknown as Record<string, unknown>;
    const unit = (value.λ as { output_units: Array<Record<string, unknown>> }).output_units[0]!;
    (unit["∇φ"] as Array<Record<string, unknown>>)[0]!.source_expression = "";
    expect(validateFamDecomposition(value).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "source-expression-required" }),
    ]));
  });

  it("unknownの原言語表現とmachine identifierを分離する", () => {
    const value = structuredClone(createLiteralDecompositionFam("降水量は未確認である。", "q://test/unknown")) as unknown as Record<string, unknown>;
    (value.Q as { unknowns: unknown[] }).unknowns.push({ source_expression: "降水量は未確認である。", source_language: "ja", concept_id: "precipitation-amount" });
    expect(validateFamDecomposition(value).valid).toBe(true);
    (value.Q as { unknowns: unknown[] }).unknowns = ["precipitation_amount"];
    expect(validateFamDecomposition(value).issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "structured-unknown-required" }),
    ]));
  });

  it("provider response schemaのrequired fieldをpropertiesへ全て宣言する", () => {
    const failures: string[] = [];
    inspectSchema(FAM_JSON_RESPONSE_SCHEMA, "$", failures);
    expect(failures).toEqual([]);
  });

  it("Gemini responseJsonSchema非対応のboolean enumと空items schemaを含めない", () => {
    const serialized = JSON.stringify(FAM_JSON_RESPONSE_SCHEMA);
    expect(serialized).not.toContain('"enum":[false]');
    expect(serialized).not.toContain('"items":{}');
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

function inspectSchema(value: unknown, path: string, failures: string[]): void {
  if (Array.isArray(value)) return value.forEach((child, index) => inspectSchema(child, `${path}[${index}]`, failures));
  if (typeof value !== "object" || value === null) return;
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.required)) {
    const properties = typeof record.properties === "object" && record.properties !== null ? record.properties as Record<string, unknown> : {};
    for (const field of record.required) if (typeof field === "string" && !(field in properties)) failures.push(`${path}.required:${field}`);
  }
  for (const [key, child] of Object.entries(record)) inspectSchema(child, `${path}.${key}`, failures);
}
