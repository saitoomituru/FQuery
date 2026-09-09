export const FAM_JSON_SCHEMA_VERSION = "fam.json/0.1.0-draft" as const;

export { classifyWithAccessMap, readAccessMapProfile } from "./access-map.js";
export type * from "./access-map.js";
export { DECOMPOSITION_PROFILE_INVARIANT_REF, normalizeDecompositionProfileInvariants, projectDecompositionUnits, stampDecompositionUnitIdentity } from "./unit-identity.js";
export type * from "./unit-identity.js";
export { propagateLocalSin, validateLocalSinMeasurement } from "./sin.js";
export type * from "./sin.js";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
export interface JsonObject { readonly [key: string]: JsonValue }

export interface FamNode extends JsonObject {
  readonly ψ: JsonValue;
  readonly "∇φ": JsonValue;
  readonly λ: JsonValue;
  readonly Q: JsonValue;
}

/** metadata profileを要求しないFAM base handshake済みrecord。 */
export type FamBaseRecord = FamNode;

export interface FamJsonRecord extends FamNode {
  readonly schema_version: typeof FAM_JSON_SCHEMA_VERSION;
  readonly fam_id: string;
  readonly revision_id: string;
  readonly kind: string;
  readonly title: string;
  readonly index_subjects: readonly JsonValue[];
  readonly pointers: readonly JsonValue[];
  readonly provenance: JsonObject;
  readonly Q: JsonObject;
}

export interface FamDocument {
  readonly value: FamJsonRecord;
  readonly originalText: string;
}

export interface FamValidationIssue {
  readonly path: string;
  readonly code: string;
  readonly message: string;
}

export interface FamValidationResult {
  readonly valid: boolean;
  readonly issues: readonly FamValidationIssue[];
  readonly nodePaths: readonly string[];
  /** FAM Coreが裁定するのは4軸構造が読めるかだけである。 */
  readonly baseStructureStatus: "valid" | "invalid";
  /** profileを指定しない検証ではnot-evaluatedのまま保持する。 */
  readonly profileConformance: "not-evaluated" | "satisfied" | "not-satisfied" | "not-evaluable";
  readonly profileRef?: string;
}

/**
 * FAM base handshake。必須なのは ψ / ∇φ / λ / Q の構造境界だけで、
 * 各軸の値、メタデータ、未知の拡張fieldの意味はここで裁定しない。
 */
export function validateFamJson(value: unknown): FamValidationResult {
  const issues: FamValidationIssue[] = [];
  const nodePaths: string[] = [];
  if (!isRecord(value)) {
    issue(issues, "$", "record-required", "FAM JSONはobjectでなければなりません");
    return freezeResult(issues, nodePaths);
  }
  validateFamNode(value, "$", issues, nodePaths);
  return freezeResult(issues, nodePaths);
}

export function readFamJson(text: string): FamDocument {
  const parsed: unknown = JSON.parse(text);
  const validation = validateFamJson(parsed);
  if (!validation.valid) throw new TypeError(formatIssues(validation.issues));
  return Object.freeze({ value: deepFreeze(parsed as FamJsonRecord), originalText: text });
}

/** 未変更documentは空白・key順・未知fieldを含む原文byteをそのまま返す。 */
export function writeUnmodifiedFamJson(document: FamDocument): string {
  return document.originalText;
}

export function serializeFamJson(value: FamJsonRecord): string {
  const validation = validateFamJson(value);
  if (!validation.valid) throw new TypeError(formatIssues(validation.issues));
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function isFamJsonRecord(value: unknown): value is FamJsonRecord {
  if (!isFamBaseRecord(value)) return false;
  return value.schema_version === FAM_JSON_SCHEMA_VERSION
    && typeof value.fam_id === "string" && value.fam_id.length > 0
    && typeof value.revision_id === "string" && value.revision_id.length > 0
    && typeof value.kind === "string" && value.kind.length > 0
    && typeof value.title === "string" && value.title.length > 0
    && Array.isArray(value.index_subjects)
    && Array.isArray(value.pointers)
    && isRecord(value.provenance)
    && isRecord(value.Q);
}

/** 最小4軸だけを満たすcandidateを、profile済みrecordと混同せず識別する。 */
export function isFamBaseRecord(value: unknown): value is FamBaseRecord {
  return validateFamJson(value).valid;
}

/** decomposition profileまで成立したcanonical候補だけを識別する。 */
export function isFamDecompositionRecord(value: unknown): value is FamJsonRecord {
  return validateFamDecomposition(value).valid;
}

export function validateFamDecomposition(value: unknown): FamValidationResult {
  const base = validateFamJson(value);
  const issues = [...base.issues];
  const nodePaths = [...base.nodePaths];
  if (!isRecord(value)) return freezeResult(issues, nodePaths, { profileConformance: "not-evaluable", profileRef: "profile://fquery/decomposition@0.1.0-draft" });
  requiredString(value, "schema_version", "$", issues);
  if (value.schema_version !== FAM_JSON_SCHEMA_VERSION) {
    issue(issues, "$.schema_version", "unsupported-schema-version", `decomposition profileのschema_versionは${FAM_JSON_SCHEMA_VERSION}でなければなりません`);
  }
  for (const field of ["fam_id", "revision_id", "kind", "title"] as const) requiredString(value, field, "$", issues);
  requiredArray(value, "index_subjects", "$", issues);
  requiredArray(value, "pointers", "$", issues);
  requiredObject(value, "provenance", "$", issues);
  if (value.kind !== "decomposition") issue(issues, "$.kind", "decomposition-kind-required", "decomposition FAMのkindはdecompositionでなければなりません");
  const psi = value.ψ;
  if (!isRecord(psi) || typeof psi.source_text !== "string" || psi.source_text.length === 0) {
    issue(issues, "$.ψ.source_text", "source-text-required", "decomposition FAMには原入力source_textが必要です");
  }
  const sourceLanguage = isRecord(psi) && typeof psi.source_language === "string" ? psi.source_language : undefined;
  if (!sourceLanguage) issue(issues, "$.ψ.source_language", "source-language-required", "decomposition FAMには原入力のsource_languageが必要です");
  if (typeof value.title_language !== "string" || value.title_language.length === 0) issue(issues, "$.title_language", "title-language-required", "title_languageは空でないstringでなければなりません");
  if (!Array.isArray(value["∇φ"])) issue(issues, "$.∇φ", "gradient-array-required", "decomposition FAMの∇φはarrayでなければなりません");
  else value["∇φ"].forEach((gradient, index) => {
    if (!isRecord(gradient) || typeof gradient.source_expression !== "string" || gradient.source_expression.length === 0) issue(issues, `$.∇φ[${index}].source_expression`, "root-gradient-source-expression-required", "root gradientには空でないsource_expressionが必要です");
    if (!isRecord(gradient) || typeof gradient.source_language !== "string" || gradient.source_language.length === 0) issue(issues, `$.∇φ[${index}].source_language`, "gradient-source-language-required", "root gradientには空でないsource_languageが必要です");
  });
  const lambda = value.λ;
  if (!isRecord(lambda) || !Array.isArray(lambda.output_units) || lambda.output_units.length === 0) {
    issue(issues, "$.λ.output_units", "output-units-required", "decomposition FAMには1件以上のnested output_unitsが必要です");
  } else {
    lambda.output_units.forEach((unit, index) => validateSourceUnit(unit, index, issues));
  }
  const q = value.Q;
  if (!isRecord(q) || !Array.isArray(q.unknowns)) issue(issues, "$.Q.unknowns", "unknowns-required", "Q.unknownsはarrayでなければなりません");
  else validateUnknownEntries(q.unknowns, "$.Q.unknowns", issues);
  if (!isRecord(q) || q.unknown_is_absence !== false) issue(issues, "$.Q.unknown_is_absence", "unknown-absence-boundary-required", "unknown_is_absenceはfalseでなければなりません");
  return freezeResult(issues, nodePaths, {
    profileConformance: base.valid && issues.length === 0 ? "satisfied" : base.valid ? "not-satisfied" : "not-evaluable",
    profileRef: "profile://fquery/decomposition@0.1.0-draft",
  });
}

export function createLiteralDecompositionFam(sourceText: string, queryRef: string): FamJsonRecord {
  if (sourceText.trim().length === 0) throw new TypeError("sourceTextは空にできません");
  const sourceLanguage = inferSourceLanguage(sourceText);
  const famId = `${queryRef}/fam`;
  const revisionId = `${queryRef}/revision/1`;
  const units = splitSource(sourceText).map((sourceFragment, index): FamNode => {
    const unitRef = `${famId}/unit/${index + 1}`;
    return ({
    ψ: { source_text: sourceFragment, source_ref: "input://source", source_language: sourceLanguage, observation_status: "provided" },
    "∇φ": [{ gradient_type: "source-segmentation", method: "punctuation-boundary", source_expression: sourceFragment, source_language: sourceLanguage, source_mutation: false }],
    λ: { manifestation: sourceFragment, manifestation_language: sourceLanguage, semantic_role: "unclassified-wisdom-unit", sub_splitters: [] },
    Q: {
      observer_ref: "observer://fquery/literal-decomposition",
      registry_ref: "registry://fquery/fam-core",
      fact_scope_ref: queryRef,
      unit_index: index,
      unit_ref: unitRef,
      unit_revision_ref: `${unitRef}/revision/1`,
      parent_fam_ref: famId,
      parent_revision_ref: revisionId,
      unit_order: index,
      claim_kind: "unknown",
      classification_status: "unknown",
      unknowns: [],
      unknown_is_absence: false,
    },
    });
  });
  return deepFreeze({
    schema_version: FAM_JSON_SCHEMA_VERSION,
    fam_id: famId,
    revision_id: revisionId,
    kind: "decomposition",
    title: sourceText,
    title_language: sourceLanguage,
    index_subjects: [],
    ψ: { source_text: sourceText, source_ref: "input://source", source_language: sourceLanguage, observation_status: "provided" },
    "∇φ": [{ gradient_type: "decomposition", method: "literal-fixture", source_expression: sourceText, source_language: sourceLanguage, source_mutation: false }],
    λ: { purpose: "source-decomposition", purpose_expression: sourceText, purpose_language: sourceLanguage, output_units: units, satisfaction_status: "not-evaluated" },
    Q: {
      observer_ref: "observer://fquery/literal-decomposition",
      registry_ref: "registry://fquery/fam-core",
      fact_scope_ref: queryRef,
      unknowns: [],
      pending_checks: ["semantic-classification", "external-fact-agreement"],
      unknown_is_absence: false,
      semantic_status: "not-evaluated",
    },
    pointers: [],
    provenance: { claim_scope: "USER_PROVIDED_TEXT", source_refs: ["input://source"], source_mutation: false },
  });
}

/**
 * Provider structured output用の一段展開Schema。
 * runtime validatorはaxis内の任意深さにある4軸nodeを再帰検証する。
 */
const UNKNOWN_ENTRY_RESPONSE_SCHEMA = Object.freeze({
  type: "object",
  required: ["source_expression", "source_language", "concept_id"],
  additionalProperties: true,
  properties: { source_expression: { type: "string" }, source_language: { type: "string" }, concept_id: { type: "string" } },
});

/** FAM base handshakeだけを求めるopen-world schema。 */
export const FAM_BASE_RESPONSE_SCHEMA: Readonly<Record<string, unknown>> = Object.freeze({
  type: "object",
  required: ["ψ", "∇φ", "λ", "Q"],
  additionalProperties: true,
  properties: {
    ψ: {},
    "∇φ": {},
    λ: {},
    Q: {},
  },
});

/** providerとdecomposition service間で使うprofile schema。base FAMの定義ではない。 */
export const FAM_DECOMPOSITION_RESPONSE_SCHEMA: Readonly<Record<string, unknown>> = Object.freeze({
  type: "object",
  required: ["schema_version", "fam_id", "revision_id", "kind", "title", "title_language", "index_subjects", "ψ", "∇φ", "λ", "Q", "pointers", "provenance"],
  additionalProperties: true,
  properties: {
    schema_version: { type: "string", enum: [FAM_JSON_SCHEMA_VERSION] },
    fam_id: { type: "string" },
    revision_id: { type: "string" },
    kind: { type: "string" },
    title: { type: "string" },
    title_language: { type: "string" },
    index_subjects: { type: "array", items: { type: "string" } },
    ψ: {
      type: "object",
      required: ["source_text", "source_ref", "source_language", "observation_status"],
      additionalProperties: true,
      properties: { source_text: { type: "string" }, source_ref: { type: "string" }, source_language: { type: "string" }, observation_status: { type: "string" } },
    },
    "∇φ": {
      type: "array",
      items: {
        type: "object",
        required: ["gradient_type", "source_expression", "source_language"],
        additionalProperties: true,
        properties: { gradient_type: { type: "string" }, source_expression: { type: "string" }, source_language: { type: "string" } },
      },
    },
    λ: {
      type: "object",
      required: ["purpose", "output_units", "satisfaction_status"],
      additionalProperties: true,
      properties: {
        purpose: { type: "string", enum: ["source-decomposition"] },
        satisfaction_status: { type: "string" },
        output_units: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            required: ["ψ", "∇φ", "λ", "Q"],
            additionalProperties: true,
            properties: {
              ψ: {
                type: "object",
                required: ["source_text", "source_ref", "source_language", "observation_status"],
                additionalProperties: true,
                properties: { source_text: { type: "string" }, source_ref: { type: "string" }, source_language: { type: "string" }, observation_status: { type: "string" } },
              },
              "∇φ": {
                type: "array",
                items: {
                  type: "object",
                  required: ["gradient_type", "source_expression", "source_language"],
                  additionalProperties: true,
                  properties: { gradient_type: { type: "string" }, source_expression: { type: "string" }, source_language: { type: "string" } },
                },
              },
              λ: {
                type: "object",
                required: ["manifestation", "manifestation_language", "sub_splitters"],
                additionalProperties: true,
                properties: {
                  manifestation: { type: "string" },
                  manifestation_language: { type: "string" },
                  sub_splitters: {
                    type: "array",
                    minItems: 1,
                    items: {
                      type: "object",
                      required: ["ψ", "∇φ", "λ", "Q"],
                      additionalProperties: true,
                      properties: {
                        ψ: {
                          type: "object",
                          required: ["source_text", "source_language", "target_language"],
                          additionalProperties: true,
                          properties: { source_text: { type: "string" }, source_language: { type: "string" }, target_language: { type: "string" } },
                        },
                        "∇φ": { type: "array", items: { type: "object", additionalProperties: true } },
                        λ: {
                          type: "object",
                          required: ["manifestation", "manifestation_language"],
                          additionalProperties: true,
                          properties: { manifestation: { type: "string" }, manifestation_language: { type: "string" } },
                        },
                        Q: {
                          type: "object",
                          required: ["copy_role", "source_node_ref", "translation_error", "unknowns", "unknown_is_absence"],
                          additionalProperties: true,
                          properties: {
                            copy_role: { type: "string", enum: ["translation-witness"] },
                            source_node_ref: { type: "string" },
                            unknowns: { type: "array", items: { type: "string" } },
                            unknown_is_absence: { type: "boolean" },
                            translation_error: {
                              type: "object",
                              required: ["status", "metric_refs", "measurements"],
                              additionalProperties: true,
                              properties: {
                                status: { type: "string", enum: ["not-evaluated", "measured"] },
                                metric_refs: { type: "array", items: { type: "string" } },
                                measurements: { type: "array", items: { type: "object", additionalProperties: true } },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              Q: {
                type: "object",
                required: ["observer_ref", "registry_ref", "fact_scope_ref", "unit_ref", "unit_revision_ref", "parent_fam_ref", "parent_revision_ref", "unit_order", "claim_kind", "unknowns", "unknown_is_absence"],
                additionalProperties: true,
                properties: {
                  observer_ref: { type: "string" }, registry_ref: { type: "string" }, fact_scope_ref: { type: "string" },
                  unit_ref: { type: "string" }, unit_revision_ref: { type: "string" }, parent_fam_ref: { type: "string" }, parent_revision_ref: { type: "string" }, unit_order: { type: "integer", minimum: 0 }, claim_kind: { type: "string" },
                  unknowns: { type: "array", items: UNKNOWN_ENTRY_RESPONSE_SCHEMA }, unknown_is_absence: { type: "boolean" },
                },
              },
            },
          },
        },
      },
    },
    Q: {
      type: "object",
      required: ["observer_ref", "registry_ref", "fact_scope_ref", "unknowns", "unknown_is_absence"],
      additionalProperties: true,
      properties: {
        observer_ref: { type: "string" }, registry_ref: { type: "string" }, fact_scope_ref: { type: "string" },
        unknowns: { type: "array", items: UNKNOWN_ENTRY_RESPONSE_SCHEMA }, unknown_is_absence: { type: "boolean" },
      },
    },
    pointers: { type: "array", items: { type: "object", additionalProperties: true } },
    provenance: { type: "object", additionalProperties: true },
  },
});

/** @deprecated decomposition providerとの互換alias。base検証に使わないこと。 */
export const FAM_JSON_RESPONSE_SCHEMA = FAM_DECOMPOSITION_RESPONSE_SCHEMA;

function validateFamNode(
  value: Record<string, unknown>,
  path: string,
  issues: FamValidationIssue[],
  nodePaths: string[],
): void {
  for (const axis of ["ψ", "∇φ", "λ", "Q"] as const) {
    if (!(axis in value)) issue(issues, `${path}.${axis}`, "axis-required", `FAM nodeには${axis}が必要です`);
  }
  if (["ψ", "∇φ", "λ", "Q"].every((axis) => axis in value)) nodePaths.push(path);
  for (const [key, child] of Object.entries(value)) inspectNested(child, `${path}.${key}`, issues, nodePaths);
}

function inspectNested(value: unknown, path: string, issues: FamValidationIssue[], nodePaths: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((child, index) => inspectNested(child, `${path}[${index}]`, issues, nodePaths));
    return;
  }
  if (!isRecord(value)) return;
  const axisCount = ["ψ", "∇φ", "λ", "Q"].filter((axis) => axis in value).length;
  // open-world拡張の単独field名をpartial FAMと誤認しない。
  // 2軸以上が現れたobjectだけをnested FAM candidateとして構造検証する。
  if (axisCount >= 2) validateFamNode(value, path, issues, nodePaths);
  else for (const [key, child] of Object.entries(value)) inspectNested(child, `${path}.${key}`, issues, nodePaths);
}

function validateSourceUnit(
  unit: unknown,
  index: number,
  issues: FamValidationIssue[],
): void {
  const path = `$.λ.output_units[${index}]`;
  if (!isRecord(unit)) return;
  const psi = unit.ψ;
  const text = isRecord(psi) ? psi.source_text : undefined;
  const q = unit.Q;
  const userOverride = isRecord(q) && q.edit_origin === "user-override";
  if (typeof text !== "string" || text.length === 0) issue(issues, `${path}.ψ.source_text`, "unit-source-text-required", "分解unitには原言語source_textが必要です");
  if (!isRecord(psi) || typeof psi.source_language !== "string" || psi.source_language.length === 0) issue(issues, `${path}.ψ.source_language`, "unit-source-language-required", "分解unitには空でないsource_languageが必要です");
  validateSourceShape(unit, path, issues);
  const lambda = unit.λ;
  if (!isRecord(q)) issue(issues, `${path}.Q`, "unit-control-boundary-required", "分解unitにはQ objectが必要です");
  else {
    requiredString(q, "observer_ref", `${path}.Q`, issues);
    requiredString(q, "registry_ref", `${path}.Q`, issues);
    requiredString(q, "fact_scope_ref", `${path}.Q`, issues);
    requiredString(q, "unit_ref", `${path}.Q`, issues);
    requiredString(q, "unit_revision_ref", `${path}.Q`, issues);
    requiredString(q, "parent_fam_ref", `${path}.Q`, issues);
    requiredString(q, "parent_revision_ref", `${path}.Q`, issues);
    requiredString(q, "claim_kind", `${path}.Q`, issues);
    if (!Number.isSafeInteger(q.unit_order) || (q.unit_order as number) < 0) issue(issues, `${path}.Q.unit_order`, "unit-order-required", "unit_orderは0以上の整数でなければなりません");
    if (userOverride) {
      requiredString(q, "override_source_ref", `${path}.Q`, issues);
      requiredString(q, "override_observer_ref", `${path}.Q`, issues);
      requiredString(q, "replaces_source_expression", `${path}.Q`, issues);
    }
    if (!Array.isArray(q.unknowns)) issue(issues, `${path}.Q.unknowns`, "unknowns-required", "unit Q.unknownsはarrayでなければなりません");
    else validateUnknownEntries(q.unknowns, `${path}.Q.unknowns`, issues);
    if (q.unknown_is_absence !== false) issue(issues, `${path}.Q.unknown_is_absence`, "unknown-absence-boundary-required", "unit unknown_is_absenceはfalseでなければなりません");
  }
  if (!isRecord(lambda) || !Array.isArray(lambda.sub_splitters)) {
    issue(issues, `${path}.λ.sub_splitters`, "sub-splitters-required", "翻訳写本を分離するsub_splitters配列が必要です");
    return;
  }
  const unitLanguage = isRecord(psi) && typeof psi.source_language === "string" ? psi.source_language : undefined;
  lambda.sub_splitters.forEach((copy, copyIndex) => validateTranslationCopy(copy, `${path}.λ.sub_splitters[${copyIndex}]`, typeof text === "string" ? text : undefined, unitLanguage, issues));
}

function validateSourceShape(unit: Record<string, unknown>, path: string, issues: FamValidationIssue[]): void {
  const gradients = unit["∇φ"];
  if (!Array.isArray(gradients) || gradients.length === 0) issue(issues, `${path}.∇φ`, "source-gradient-required", "原言語の意味gradientが必要です");
  else gradients.forEach((gradient, index) => {
    if (!isRecord(gradient) || typeof gradient.source_expression !== "string" || gradient.source_expression.length === 0) issue(issues, `${path}.∇φ[${index}].source_expression`, "source-expression-required", "gradientには空でないsource_expressionが必要です");
    if (!isRecord(gradient) || typeof gradient.source_language !== "string" || gradient.source_language.length === 0) issue(issues, `${path}.∇φ[${index}].source_language`, "gradient-source-language-required", "gradientには空でないsource_languageが必要です");
  });
  const manifestation = isRecord(unit.λ) ? unit.λ.manifestation : undefined;
  if (typeof manifestation !== "string" || manifestation.length === 0) issue(issues, `${path}.λ.manifestation`, "manifestation-required", "nodeの顕現には空でないmanifestationが必要です");
  if (!isRecord(unit.λ) || typeof unit.λ.manifestation_language !== "string" || unit.λ.manifestation_language.length === 0) issue(issues, `${path}.λ.manifestation_language`, "manifestation-language-required", "nodeの顕現には空でないmanifestation_languageが必要です");
}

function validateTranslationCopy(copy: unknown, path: string, sourceText: string | undefined, sourceLanguage: string | undefined, issues: FamValidationIssue[]): void {
  if (!isRecord(copy)) return;
  const psi = copy.ψ;
  if (!isRecord(psi) || psi.source_text !== sourceText || psi.source_language !== sourceLanguage || typeof psi.target_language !== "string") issue(issues, `${path}.ψ`, "translation-language-lineage-required", "翻訳写本には正本原文、source_language、target_languageが必要です");
  const q = copy.Q;
  const lambda = copy.λ;
  const error = isRecord(q) ? q.translation_error : undefined;
  if (!isRecord(q) || q.copy_role !== "translation-witness" || typeof q.source_node_ref !== "string") issue(issues, `${path}.Q`, "translation-copy-lineage-required", "翻訳写本にはcopy_roleとsource_node_refが必要です");
  if (!isRecord(error) || !["not-evaluated", "measured"].includes(String(error.status)) || !Array.isArray(error.metric_refs) || !Array.isArray(error.measurements)) issue(issues, `${path}.Q.translation_error`, "translation-error-ledger-required", "翻訳誤差の状態・metric参照・測定履歴が必要です");
  if (!isRecord(lambda) || !isRecord(psi) || lambda.manifestation_language !== psi.target_language) issue(issues, `${path}.λ.manifestation_language`, "translation-target-language-mismatch", "翻訳顕現の言語はtarget_languageと一致しなければなりません");
}

function validateUnknownEntries(entries: readonly unknown[], path: string, issues: FamValidationIssue[]): void {
  entries.forEach((entry, index) => {
    const entryPath = `${path}[${index}]`;
    if (!isRecord(entry) || typeof entry.source_expression !== "string" || typeof entry.concept_id !== "string") {
      issue(issues, entryPath, "structured-unknown-required", "unknownは原言語表現とmachine concept_idを分離したobjectでなければなりません");
      return;
    }
    if (typeof entry.source_language !== "string" || entry.source_language.length === 0) issue(issues, `${entryPath}.source_language`, "unknown-source-language-required", "unknownには空でないsource_languageが必要です");
  });
}

function requiredString(value: Record<string, unknown>, field: string, path: string, issues: FamValidationIssue[]): void {
  if (typeof value[field] !== "string" || value[field].length === 0) issue(issues, `${path}.${field}`, "string-required", `${field}は空でないstringでなければなりません`);
}

function requiredArray(value: Record<string, unknown>, field: string, path: string, issues: FamValidationIssue[]): void {
  if (!Array.isArray(value[field])) issue(issues, `${path}.${field}`, "array-required", `${field}はarrayでなければなりません`);
}

function requiredObject(value: Record<string, unknown>, field: string, path: string, issues: FamValidationIssue[]): void {
  if (!isRecord(value[field])) issue(issues, `${path}.${field}`, "object-required", `${field}はobjectでなければなりません`);
}

function issue(issues: FamValidationIssue[], path: string, code: string, message: string): void {
  issues.push(Object.freeze({ path, code, message }));
}

function freezeResult(
  issues: FamValidationIssue[],
  nodePaths: string[],
  options: { readonly profileConformance?: FamValidationResult["profileConformance"]; readonly profileRef?: string } = {},
): FamValidationResult {
  const baseStructureStatus = issues.some((entry) => entry.code === "record-required" || entry.code === "axis-required") ? "invalid" : "valid";
  return Object.freeze({
    valid: issues.length === 0,
    issues: Object.freeze(issues),
    nodePaths: Object.freeze(nodePaths),
    baseStructureStatus,
    profileConformance: options.profileConformance ?? "not-evaluated",
    ...(options.profileRef ? { profileRef: options.profileRef } : {}),
  });
}

function formatIssues(issues: readonly FamValidationIssue[]): string {
  return issues.map((entry) => `${entry.path}:${entry.code}:${entry.message}`).join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const child of value) deepFreeze(child);
    return Object.freeze(value);
  }
  if (isRecord(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value) as T;
  }
  return value;
}

/** 言語の断定ではなく、入力scriptから得られる最小のBCP 47風hintを返す。 */
export function inferSourceLanguage(sourceText: unknown): string {
  if (typeof sourceText !== "string") return "und";
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(sourceText)) return "ja";
  if (/\p{Script=Arabic}/u.test(sourceText)) return "ar";
  if (/\p{Script=Hebrew}/u.test(sourceText)) return "und-Hebr";
  if (/\p{Script=Han}/u.test(sourceText)) return "und-Hani";
  if (/[A-Za-z]/u.test(sourceText)) return "en";
  return "und";
}

function splitSource(sourceText: string): string[] {
  const matches = sourceText.match(/[^。！？.!?]+[。！？.!?]?/gu)?.map((value) => value.trim()).filter(Boolean);
  return matches && matches.length > 0 ? matches : [sourceText.trim()];
}
