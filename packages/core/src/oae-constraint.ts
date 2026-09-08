import type { OaeConstraintEvaluationReceipt } from "./types.js";

export interface OaeConstraintReceiptValidation {
  readonly valid: boolean;
  readonly issues: readonly string[];
}

/**
 * domain固有ruleの中身やobserver verdictの真偽は裁定しない。
 * 外部evaluatorが返したOAE拘束評価receiptの参照束縛と状態整合だけを検証する。
 */
export function validateOaeConstraintEvaluationReceipt(value: unknown): OaeConstraintReceiptValidation {
  const issues: string[] = [];
  if (!isRecord(value)) return Object.freeze({ valid: false, issues: Object.freeze(["oae-constraint-receipt-object-required"]) });

  for (const field of [
    "subjectRef", "subjectRevisionRef", "observerRef", "observerDomainRef",
    "ruleRef", "ruleRevisionRef", "candidateRecordRef", "candidateRecordRevisionRef",
    "evaluatorRef", "evaluatorRevisionRef", "observerVerdict",
  ] as const) {
    if (typeof value[field] !== "string" || value[field].length === 0) issues.push(`oae-constraint-${field}-required`);
  }
  if (!isStringArray(value.evidenceRefs)) issues.push("oae-constraint-evidence-refs-required");
  if (!isStringArray(value.issueCodes)) issues.push("oae-constraint-issue-codes-required");
  if (value.recordIntegrity !== "valid" && value.recordIntegrity !== "invalid") issues.push("oae-constraint-record-integrity-invalid");
  if (!(["satisfied", "not-satisfied", "not-evaluable"] as const).includes(value.ruleConformance as never)) issues.push("oae-constraint-rule-conformance-invalid");
  if (value.recordIntegrity === "invalid" && value.ruleConformance === "satisfied") issues.push("oae-constraint-invalid-record-cannot-satisfy-rule");
  if (value.ruleConformance === "not-evaluable" && isStringArray(value.issueCodes) && value.issueCodes.length === 0) issues.push("oae-constraint-not-evaluable-reason-required");

  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.length > 0);
}
