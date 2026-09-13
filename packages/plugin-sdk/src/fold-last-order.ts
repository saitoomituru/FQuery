import type { LastOrder } from "@fquery/core";

/**
 * Issue #50: Fold-chain解決が`⊥`(Core既存LastOrder形状)を返した事実を、
 * OaeConstraintEvaluationReceipt(packages/plugin-sdk/src/oae-evaluator.ts)と
 * 同じ設計思想でOAE receiptとして記録する。Coreはdomain固有の成立条件を
 * 裁定せず、参照束縛と確定可能性だけを保持する。
 *
 * 詳細: docs/specification/fam-q-declaration-execution.ja.md §7
 */
export interface FoldLastOrderReceipt {
  readonly schemaVersion: "fquery.fold-last-order/0.1.0-draft";
  /** last-orderされたcallまたはnodeの参照(例: QCall.key、fam_ref)。 */
  readonly subjectRef: string;
  readonly lastOrder: LastOrder;
  /** 削除されず非ゼロサムで残る、last-orderの影響を受けない兄弟枝の参照群。 */
  readonly siblingRefs: readonly string[];
  readonly observedAt: string;
}

export interface CreateFoldLastOrderReceiptInput {
  readonly subjectRef: string;
  readonly lastOrder: LastOrder;
  readonly siblingRefs?: readonly string[];
  readonly now?: () => Date;
}

export function createFoldLastOrderReceipt(input: CreateFoldLastOrderReceiptInput): FoldLastOrderReceipt {
  const now = input.now ?? (() => new Date());
  return Object.freeze({
    schemaVersion: "fquery.fold-last-order/0.1.0-draft",
    subjectRef: input.subjectRef,
    lastOrder: Object.freeze({ ...input.lastOrder }),
    siblingRefs: Object.freeze([...(input.siblingRefs ?? [])]),
    observedAt: now().toISOString(),
  });
}

export interface FoldLastOrderReceiptValidation {
  readonly valid: boolean;
  readonly issues: readonly string[];
}

/**
 * evaluator adapter向けの任意helper。Coreはこの判定を呼ばず、返されたOAEを保存する。
 * lastOrder.reason/codeの語彙自体はCore/pluginが裁定しない。
 */
export function validateFoldLastOrderReceipt(value: unknown): FoldLastOrderReceiptValidation {
  const issues: string[] = [];
  if (!isRecord(value)) return Object.freeze({ valid: false, issues: Object.freeze(["fold-last-order-object-required"]) });
  if (value.schemaVersion !== "fquery.fold-last-order/0.1.0-draft") issues.push("fold-last-order-schema-version-required");
  if (typeof value.subjectRef !== "string" || value.subjectRef.length === 0) issues.push("fold-last-order-subject-ref-required");
  if (typeof value.observedAt !== "string" || value.observedAt.length === 0) issues.push("fold-last-order-observed-at-required");
  if (!isStringArray(value.siblingRefs)) issues.push("fold-last-order-sibling-refs-required");
  const lastOrder = value.lastOrder;
  if (!isRecord(lastOrder)) {
    issues.push("fold-last-order-last-order-required");
  } else {
    for (const field of ["code", "reason", "requestedNext", "resumeWhen"] as const) {
      if (typeof lastOrder[field] !== "string" || lastOrder[field].length === 0) issues.push(`fold-last-order-last-order-${field}-required`);
    }
  }
  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
}

export function asFoldLastOrderReceipt(value: unknown): FoldLastOrderReceipt | undefined {
  return validateFoldLastOrderReceipt(value).valid ? (value as FoldLastOrderReceipt) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}
