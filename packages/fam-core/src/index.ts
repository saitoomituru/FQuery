export const FAM_JSON_SCHEMA_VERSION = "fam.json/0.1.0-draft" as const;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
export interface JsonObject { readonly [key: string]: JsonValue }

export interface FamNode extends JsonObject {
  readonly ψ: JsonValue;
  readonly "∇φ": JsonValue;
  readonly λ: JsonValue;
  readonly Q: JsonObject;
}

export interface FamJsonRecord extends FamNode {
  readonly schema_version: typeof FAM_JSON_SCHEMA_VERSION;
  readonly fam_id: string;
  readonly revision_id: string;
  readonly kind: string;
  readonly title: string;
  readonly index_subjects: readonly JsonValue[];
  readonly pointers: readonly JsonValue[];
  readonly provenance: JsonObject;
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
}

export function validateFamJson(value: unknown): FamValidationResult {
  const issues: FamValidationIssue[] = [];
  const nodePaths: string[] = [];
  if (!isRecord(value)) {
    issue(issues, "$", "record-required", "FAM JSONはobjectでなければなりません");
    return freezeResult(issues, nodePaths);
  }
  requiredString(value, "schema_version", "$", issues);
  if (value.schema_version !== FAM_JSON_SCHEMA_VERSION) {
    issue(issues, "$.schema_version", "unsupported-schema-version", `schema_versionは${FAM_JSON_SCHEMA_VERSION}でなければなりません`);
  }
  for (const field of ["fam_id", "revision_id", "kind", "title"] as const) requiredString(value, field, "$", issues);
  requiredArray(value, "index_subjects", "$", issues);
  requiredArray(value, "pointers", "$", issues);
  requiredObject(value, "provenance", "$", issues);
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
  return validateFamJson(value).valid;
}

export function validateFamDecomposition(value: unknown): FamValidationResult {
  const base = validateFamJson(value);
  const issues = [...base.issues];
  const nodePaths = [...base.nodePaths];
  if (!isRecord(value)) return freezeResult(issues, nodePaths);
  const psi = value.ψ;
  if (!isRecord(psi) || typeof psi.source_text !== "string" || psi.source_text.length === 0) {
    issue(issues, "$.ψ.source_text", "source-text-required", "decomposition FAMには原入力source_textが必要です");
  }
  if (!Array.isArray(value["∇φ"])) issue(issues, "$.∇φ", "gradient-array-required", "decomposition FAMの∇φはarrayでなければなりません");
  const lambda = value.λ;
  if (!isRecord(lambda) || !Array.isArray(lambda.output_units) || lambda.output_units.length === 0) {
    issue(issues, "$.λ.output_units", "output-units-required", "decomposition FAMには1件以上のnested output_unitsが必要です");
  }
  const q = value.Q;
  if (!isRecord(q) || !Array.isArray(q.unknowns)) issue(issues, "$.Q.unknowns", "unknowns-required", "Q.unknownsはarrayでなければなりません");
  if (!isRecord(q) || q.unknown_is_absence !== false) issue(issues, "$.Q.unknown_is_absence", "unknown-absence-boundary-required", "unknown_is_absenceはfalseでなければなりません");
  return freezeResult(issues, nodePaths);
}

export function createLiteralDecompositionFam(sourceText: string, queryRef: string): FamJsonRecord {
  if (sourceText.trim().length === 0) throw new TypeError("sourceTextは空にできません");
  const units = splitSource(sourceText).map((sourceFragment, index): FamNode => ({
    ψ: { source_text: sourceFragment, source_ref: "input://source", observation_status: "provided" },
    "∇φ": [{ gradient_type: "source-segmentation", method: "punctuation-boundary", source_mutation: false }],
    λ: { manifestation: sourceFragment, semantic_role: "unclassified-wisdom-unit" },
    Q: {
      observer_ref: "observer://fquery/literal-decomposition",
      registry_ref: "registry://fquery/fam-core",
      fact_scope_ref: queryRef,
      unit_index: index,
      classification_status: "unknown",
      unknowns: [],
      unknown_is_absence: false,
    },
  }));
  return deepFreeze({
    schema_version: FAM_JSON_SCHEMA_VERSION,
    fam_id: `${queryRef}/fam`,
    revision_id: `${queryRef}/revision/1`,
    kind: "decomposition",
    title: "入力sourceのFAM分解候補",
    index_subjects: [],
    ψ: { source_text: sourceText, source_ref: "input://source", observation_status: "provided" },
    "∇φ": [{ gradient_type: "decomposition", method: "literal-fixture", source_mutation: false }],
    λ: { purpose: "sourceを改変せずFAM単位へ分解する", output_units: units, satisfaction_status: "not-evaluated" },
    Q: {
      observer_ref: "observer://fquery/literal-decomposition",
      registry_ref: "registry://fquery/fam-core",
      fact_scope_ref: queryRef,
      unknowns: ["意味分類", "外部事実との一致"],
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
export const FAM_JSON_RESPONSE_SCHEMA: Readonly<Record<string, unknown>> = Object.freeze({
  type: "object",
  required: ["schema_version", "fam_id", "revision_id", "kind", "title", "index_subjects", "ψ", "∇φ", "λ", "Q", "pointers", "provenance"],
  additionalProperties: true,
  properties: {
    schema_version: { type: "string", enum: [FAM_JSON_SCHEMA_VERSION] },
    fam_id: { type: "string" },
    revision_id: { type: "string" },
    kind: { type: "string" },
    title: { type: "string" },
    index_subjects: { type: "array", items: {} },
    ψ: {
      type: "object",
      required: ["source_text", "source_ref", "observation_status"],
      additionalProperties: true,
      properties: { source_text: { type: "string" }, source_ref: { type: "string" }, observation_status: { type: "string" } },
    },
    "∇φ": { type: "array", items: { type: "object", additionalProperties: true } },
    λ: {
      type: "object",
      required: ["purpose", "output_units", "satisfaction_status"],
      additionalProperties: true,
      properties: {
        purpose: { type: "string" },
        satisfaction_status: { type: "string" },
        output_units: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            required: ["ψ", "∇φ", "λ", "Q"],
            additionalProperties: true,
            properties: {
              ψ: { type: "object", additionalProperties: true },
              "∇φ": { type: "array", items: { type: "object", additionalProperties: true } },
              λ: { type: "object", additionalProperties: true },
              Q: { type: "object", additionalProperties: true },
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
        unknowns: { type: "array", items: { type: "string" } }, unknown_is_absence: { type: "boolean", enum: [false] },
      },
    },
    pointers: { type: "array", items: {} },
    provenance: { type: "object", additionalProperties: true },
  },
});

function validateFamNode(
  value: Record<string, unknown>,
  path: string,
  issues: FamValidationIssue[],
  nodePaths: string[],
): void {
  for (const axis of ["ψ", "∇φ", "λ", "Q"] as const) {
    if (!(axis in value)) issue(issues, `${path}.${axis}`, "axis-required", `FAM nodeには${axis}が必要です`);
  }
  if ("Q" in value && !isRecord(value.Q)) issue(issues, `${path}.Q`, "q-object-required", "Qはobjectでなければなりません");
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
  if (axisCount > 0) validateFamNode(value, path, issues, nodePaths);
  else for (const [key, child] of Object.entries(value)) inspectNested(child, `${path}.${key}`, issues, nodePaths);
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

function freezeResult(issues: FamValidationIssue[], nodePaths: string[]): FamValidationResult {
  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues), nodePaths: Object.freeze(nodePaths) });
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

function splitSource(sourceText: string): string[] {
  const matches = sourceText.match(/[^。！？.!?]+[。！？.!?]?/gu)?.map((value) => value.trim()).filter(Boolean);
  return matches && matches.length > 0 ? matches : [sourceText.trim()];
}
