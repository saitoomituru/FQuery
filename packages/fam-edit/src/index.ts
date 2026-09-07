import { createHash } from "node:crypto";
import {
  readFamJson,
  serializeFamJson,
  validateFamJson,
  type FamDocument,
  type FamJsonRecord,
  type FamValidationIssue,
  type FamValidationResult,
  type JsonObject,
  type JsonValue,
} from "@fquery/fam-core";

export const FAM_EDIT_RECEIPT_VERSION = "fquery.fam-edit-receipt/0.1.0-draft" as const;

export type FamPatch =
  | { readonly op: "set"; readonly path: string; readonly value: JsonValue }
  | { readonly op: "remove"; readonly path: string }
  | { readonly op: "insert"; readonly path: string; readonly index: number; readonly value: JsonValue };

export interface FamPatchRequest {
  readonly operationId: string;
  readonly baseRevisionId: string;
  readonly resultRevisionId: string;
  readonly patches: readonly FamPatch[];
}

export interface FamEditReceipt {
  readonly schemaVersion: typeof FAM_EDIT_RECEIPT_VERSION;
  readonly operationId: string;
  readonly famId: string;
  readonly baseRevisionId: string;
  readonly resultRevisionId: string | null;
  readonly status: "accepted" | "rejected";
  readonly reason?: FamEditRejectionReason;
  readonly beforeSha256: string;
  readonly afterSha256: string | null;
  readonly patches: readonly FamPatch[];
  readonly validationIssues: readonly FamValidationIssue[];
  readonly losses: readonly string[];
  readonly sourceMutation: false;
  readonly observedAt: string;
}

export type FamEditRejectionReason =
  | "empty-operation-id"
  | "stale-base-revision"
  | "invalid-result-revision"
  | "empty-patch-set"
  | "invalid-json-pointer"
  | "path-not-found"
  | "path-type-mismatch"
  | "array-index-out-of-range"
  | "protected-field"
  | "fam-validation-failed";

export type FamPatchDecision =
  | { readonly status: "accepted"; readonly document: FamDocument; readonly receipt: FamEditReceipt }
  | { readonly status: "rejected"; readonly document: FamDocument; readonly receipt: FamEditReceipt };

export interface FamEditOptions {
  readonly validate?: (value: unknown) => FamValidationResult;
  readonly clock?: () => Date;
}

const PROTECTED_ROOT_FIELDS = new Set(["schema_version", "fam_id", "revision_id"]);

export function applyFamPatch(
  document: FamDocument,
  request: FamPatchRequest,
  options: FamEditOptions = {},
): FamPatchDecision {
  const beforeSha256 = sha256(document.originalText);
  const observedAt = (options.clock ?? (() => new Date()))().toISOString();
  const baseReceipt = {
    schemaVersion: FAM_EDIT_RECEIPT_VERSION,
    operationId: request.operationId,
    famId: document.value.fam_id,
    baseRevisionId: request.baseRevisionId,
    patches: freezePatches(request.patches),
    beforeSha256,
    losses: Object.freeze([]) as readonly string[],
    sourceMutation: false as const,
    observedAt,
  };

  const preconditionFailure = validateRequest(document, request);
  if (preconditionFailure) {
    return reject(document, baseReceipt, request.resultRevisionId, preconditionFailure, []);
  }

  const candidate = structuredClone(document.value) as unknown as Record<string, unknown>;
  try {
    for (const patch of request.patches) applyOperation(candidate, patch);
  } catch (error) {
    const failure = error instanceof PatchError ? error.reason : "path-type-mismatch";
    return reject(document, baseReceipt, request.resultRevisionId, failure, []);
  }
  candidate.revision_id = request.resultRevisionId;

  const validation = (options.validate ?? validateFamJson)(candidate);
  if (!validation.valid) {
    return reject(document, baseReceipt, request.resultRevisionId, "fam-validation-failed", validation.issues);
  }

  const serialized = serializeFamJson(candidate as unknown as FamJsonRecord);
  const nextDocument = readFamJson(serialized);
  const receipt: FamEditReceipt = Object.freeze({
    ...baseReceipt,
    resultRevisionId: request.resultRevisionId,
    status: "accepted",
    afterSha256: sha256(serialized),
    validationIssues: Object.freeze([]),
  });
  return Object.freeze({ status: "accepted", document: nextDocument, receipt });
}

function validateRequest(document: FamDocument, request: FamPatchRequest): FamEditRejectionReason | undefined {
  if (request.operationId.length === 0) return "empty-operation-id";
  if (request.baseRevisionId !== document.value.revision_id) return "stale-base-revision";
  if (request.resultRevisionId.length === 0 || request.resultRevisionId === request.baseRevisionId) return "invalid-result-revision";
  if (request.patches.length === 0) return "empty-patch-set";
  for (const patch of request.patches) {
    let segments: readonly string[];
    try {
      segments = parsePointer(patch.path);
    } catch {
      return "invalid-json-pointer";
    }
    if (segments.length === 0) return "protected-field";
    if (PROTECTED_ROOT_FIELDS.has(segments[0]!)) return "protected-field";
    if (patch.op === "insert" && (!Number.isSafeInteger(patch.index) || patch.index < 0)) return "array-index-out-of-range";
  }
  return undefined;
}

function applyOperation(root: Record<string, unknown>, patch: FamPatch): void {
  const segments = parsePointer(patch.path);
  if (patch.op === "insert") {
    const target = valueAt(root, segments);
    if (!Array.isArray(target)) throw new PatchError("path-type-mismatch");
    if (patch.index > target.length) throw new PatchError("array-index-out-of-range");
    target.splice(patch.index, 0, structuredClone(patch.value));
    return;
  }

  const { parent, key } = parentAt(root, segments);
  if (Array.isArray(parent)) {
    const index = arrayIndex(key, parent.length, false);
    if (patch.op === "remove") parent.splice(index, 1);
    else parent[index] = structuredClone(patch.value);
    return;
  }
  if (!isMutableRecord(parent)) throw new PatchError("path-type-mismatch");
  if (patch.op === "remove") {
    if (!(key in parent)) throw new PatchError("path-not-found");
    delete parent[key];
  } else {
    parent[key] = structuredClone(patch.value);
  }
}

function valueAt(root: unknown, segments: readonly string[]): unknown {
  let current = root;
  for (const segment of segments) {
    if (Array.isArray(current)) current = current[arrayIndex(segment, current.length, false)];
    else if (isMutableRecord(current) && segment in current) current = current[segment];
    else throw new PatchError(isMutableRecord(current) ? "path-not-found" : "path-type-mismatch");
  }
  return current;
}

function parentAt(root: unknown, segments: readonly string[]): { parent: unknown; key: string } {
  if (segments.length === 0) throw new PatchError("protected-field");
  const key = segments[segments.length - 1]!;
  return { parent: valueAt(root, segments.slice(0, -1)), key };
}

function parsePointer(pointer: string): readonly string[] {
  if (!pointer.startsWith("/") || pointer.includes("~") && /~(?:[^01]|$)/.test(pointer)) throw new PatchError("invalid-json-pointer");
  return pointer.slice(1).split("/").map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function arrayIndex(segment: string, length: number, allowEnd: boolean): number {
  if (!/^(0|[1-9][0-9]*)$/.test(segment)) throw new PatchError("path-type-mismatch");
  const index = Number(segment);
  if (!Number.isSafeInteger(index) || index < 0 || index >= length + (allowEnd ? 1 : 0)) throw new PatchError("array-index-out-of-range");
  return index;
}

function reject(
  document: FamDocument,
  base: Omit<FamEditReceipt, "resultRevisionId" | "status" | "reason" | "afterSha256" | "validationIssues">,
  resultRevisionId: string,
  reason: FamEditRejectionReason,
  issues: readonly FamValidationIssue[],
): FamPatchDecision {
  const receipt: FamEditReceipt = Object.freeze({
    ...base,
    resultRevisionId: resultRevisionId.length > 0 ? resultRevisionId : null,
    status: "rejected",
    reason,
    afterSha256: null,
    validationIssues: Object.freeze([...issues]),
  });
  return Object.freeze({ status: "rejected", document, receipt });
}

function freezePatches(patches: readonly FamPatch[]): readonly FamPatch[] {
  return Object.freeze(patches.map((patch) => Object.freeze(structuredClone(patch))));
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isMutableRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class PatchError extends Error {
  constructor(readonly reason: FamEditRejectionReason) {
    super(reason);
  }
}

export type { FamDocument, FamJsonRecord, FamValidationIssue, FamValidationResult, JsonObject, JsonValue };
