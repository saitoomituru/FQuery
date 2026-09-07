export const FAM_DRAFT_PATCH_SCHEMA_VERSION = "fquery.fam-draft-patch/0.1.0-draft" as const;
export const FAM_DRAFT_RECEIPT_SCHEMA_VERSION = "fquery.fam-draft-preview-receipt/0.1.0-draft" as const;

import type { JsonObject, JsonValue } from "@fquery/fam-core";

/** RFC 6901 JSON Pointer。`""`はdocument root。 */
export type JsonPointer = string;

export type FamDraftPatchOperation =
  | { readonly op: "set"; readonly path: JsonPointer; readonly value: JsonValue }
  | { readonly op: "remove"; readonly path: JsonPointer }
  | { readonly op: "insert"; readonly path: JsonPointer; readonly value: JsonValue };

export interface FamDraftPatch {
  readonly schemaVersion: typeof FAM_DRAFT_PATCH_SCHEMA_VERSION;
  readonly operations: readonly FamDraftPatchOperation[];
}

/** 呼び出し側が注入するvalidatorの最小形。FAM Coreの型へ依存しない。 */
export interface ValidationIssueLike { readonly path: string; readonly code: string; readonly message: string }
export interface ValidationResultLike { readonly valid: boolean; readonly issues: readonly ValidationIssueLike[] }
export type FamValidator = (value: unknown) => ValidationResultLike;

export type EditableFamDocument =
  | { readonly parse: "parsed"; readonly text: string; readonly value: JsonValue }
  | { readonly parse: "unparsed"; readonly text: string; readonly parseError: string };

export interface FamDiffEntry {
  readonly path: JsonPointer;
  readonly change: "added" | "removed" | "replaced";
  readonly before?: JsonValue;
  readonly after?: JsonValue;
}

export interface FamDraftReceipt {
  readonly schemaVersion: typeof FAM_DRAFT_RECEIPT_SCHEMA_VERSION;
  readonly status: "applied" | "rejected" | "unchanged";
  readonly appliedOperations: number;
  readonly rejectedOperation?: { readonly index: number; readonly reason: string };
  readonly touchedPaths: readonly JsonPointer[];
  readonly retainedUntouchedPaths: number;
  readonly validation?: { readonly valid: boolean; readonly issueCount: number };
  readonly loss: readonly FamLossEntry[];
}

export interface FamLossEntry {
  readonly kind: "manual-replacement" | "unparsed-source-discarded";
  readonly detail: string;
}

export interface FamDraftResult {
  readonly document: EditableFamDocument;
  readonly diff: readonly FamDiffEntry[];
  readonly receipt: FamDraftReceipt;
  readonly validation?: ValidationResultLike;
}

/** textを開く。malformedでも例外を投げず`unparsed`として原文を保持する。 */
export function openFamText(text: string): EditableFamDocument {
  try {
    const value: unknown = JSON.parse(text);
    return Object.freeze({ parse: "parsed", text, value: deepFreeze(value as JsonValue) });
  } catch (error) {
    return Object.freeze({ parse: "unparsed", text, parseError: error instanceof Error ? error.message : String(error) });
  }
}

export function createFamDraftPatch(operations: readonly FamDraftPatchOperation[]): FamDraftPatch {
  return Object.freeze({ schemaVersion: FAM_DRAFT_PATCH_SCHEMA_VERSION, operations: Object.freeze([...operations]) });
}

export interface PreviewFamDraftOptions {
  readonly validate?: FamValidator;
  readonly indent?: number;
}

/**
 * patchを適用し、編集対象path以外を一切変更しないdocumentを返す。
 * 操作が空なら原文byteをそのまま返す。1操作でも失敗すれば全体をrejectedにする。
 */
export function previewFamDraftPatch(document: EditableFamDocument, patch: FamDraftPatch, options: PreviewFamDraftOptions = {}): FamDraftResult {
  if (patch.schemaVersion !== FAM_DRAFT_PATCH_SCHEMA_VERSION) return rejected(document, 0, "unsupported-patch-schema-version", options);
  if (document.parse === "unparsed") return rejected(document, 0, "document-unparsed", options);
  if (patch.operations.length === 0) {
    const validation = options.validate?.(document.value);
    return Object.freeze({ document, diff: Object.freeze([]), receipt: receipt("unchanged", 0, [], countPaths(document.value), validation, []), ...(validation ? { validation } : {}) });
  }
  let working: JsonValue = document.value;
  const touched: JsonPointer[] = [];
  for (const [index, operation] of patch.operations.entries()) {
    const outcome = applyOperation(working, operation);
    if (!outcome.ok) return rejected(document, index, outcome.reason, options);
    working = outcome.value;
    touched.push(operation.path);
  }
  const frozen = deepFreeze(working);
  const diff = diffJson(document.value, frozen);
  const validation = options.validate?.(frozen);
  const text = serializeFamValue(frozen, options.indent ?? 2);
  const untouched = countPaths(document.value) - new Set(diff.map((entry) => entry.path)).size;
  return Object.freeze({
    document: Object.freeze({ parse: "parsed", text, value: frozen }),
    diff,
    receipt: receipt("applied", patch.operations.length, touched, Math.max(0, untouched), validation, []),
    ...(validation ? { validation } : {}),
  });
}

/** RAW editorでtext全体を置換する。unparsedからの復帰も含め、必ずloss receiptを残す。 */
export function previewFamTextReplacement(document: EditableFamDocument, text: string, options: PreviewFamDraftOptions = {}): FamDraftResult {
  const next = openFamText(text);
  const loss: FamLossEntry[] = [{ kind: "manual-replacement", detail: document.parse === "parsed" ? "parsed document replaced by raw text" : "unparsed source replaced by raw text" }];
  if (document.parse === "unparsed" && next.parse === "parsed") loss.push({ kind: "unparsed-source-discarded", detail: document.parseError });
  const diff = document.parse === "parsed" && next.parse === "parsed" ? diffJson(document.value, next.value) : Object.freeze([]);
  const validation = next.parse === "parsed" ? options.validate?.(next.value) : undefined;
  const status = document.text === text ? "unchanged" : "applied";
  return Object.freeze({
    document: next,
    diff,
    receipt: receipt(status, status === "applied" ? 1 : 0, diff.map((entry) => entry.path), next.parse === "parsed" ? countPaths(next.value) - diff.length : 0, validation, loss),
    ...(validation ? { validation } : {}),
  });
}

export function serializeFamValue(value: JsonValue, indent = 2): string {
  return `${JSON.stringify(value, null, indent)}\n`;
}

export function getAtPointer(value: JsonValue, pointer: JsonPointer): JsonValue | undefined {
  let current: JsonValue | undefined = value;
  for (const token of parsePointer(pointer)) {
    if (current === undefined || current === null || typeof current !== "object") return undefined;
    if (Array.isArray(current)) {
      const index = arrayIndex(token, current.length);
      current = index === undefined ? undefined : current[index];
    } else {
      current = Object.prototype.hasOwnProperty.call(current, token) ? (current as JsonObject)[token] : undefined;
    }
  }
  return current;
}

/** documentに存在する全pathをJSON Pointerで列挙する（rootを除く、container含む）。 */
export function listPointers(value: JsonValue, prefix: JsonPointer = ""): readonly JsonPointer[] {
  const pointers: JsonPointer[] = [];
  walk(value, prefix, (pointer) => { if (pointer !== "") pointers.push(pointer); });
  return Object.freeze(pointers);
}

export interface PointerPartition {
  readonly known: readonly JsonPointer[];
  readonly unsupported: readonly JsonPointer[];
}

/**
 * plugin／panelが認識するpath集合に対して、canonical documentの各leaf pathを
 * known / unsupportedへ分割する。`unsupported != invalid`。
 * knownPrefixesはJSON Pointer prefixで、配下全体をknownとして扱う。
 */
export function partitionPointers(value: JsonValue, knownPrefixes: readonly JsonPointer[]): PointerPartition {
  const known: JsonPointer[] = [];
  const unsupported: JsonPointer[] = [];
  for (const pointer of leafPointers(value)) {
    (knownPrefixes.some((prefix) => pointer === prefix || pointer.startsWith(`${prefix}/`)) ? known : unsupported).push(pointer);
  }
  return Object.freeze({ known: Object.freeze(known), unsupported: Object.freeze(unsupported) });
}

export function leafPointers(value: JsonValue): readonly JsonPointer[] {
  const pointers: JsonPointer[] = [];
  walk(value, "", (pointer, node) => {
    const isContainer = node !== null && typeof node === "object" && (Array.isArray(node) ? node.length > 0 : Object.keys(node).length > 0);
    if (!isContainer) pointers.push(pointer);
  });
  return Object.freeze(pointers.filter((pointer) => pointer !== "" || pointers.length === 1));
}

export function diffJson(before: JsonValue, after: JsonValue, prefix: JsonPointer = ""): readonly FamDiffEntry[] {
  if (deepEqual(before, after)) return Object.freeze([]);
  const entries: FamDiffEntry[] = [];
  if (isObject(before) && isObject(after)) {
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const path = `${prefix}/${escapeToken(key)}`;
      if (!(key in before)) entries.push(Object.freeze({ path, change: "added", after: after[key]! }));
      else if (!(key in after)) entries.push(Object.freeze({ path, change: "removed", before: before[key]! }));
      else entries.push(...diffJson(before[key]!, after[key]!, path));
    }
    return Object.freeze(entries);
  }
  if (Array.isArray(before) && Array.isArray(after)) {
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      const path = `${prefix}/${index}`;
      if (index >= before.length) entries.push(Object.freeze({ path, change: "added", after: after[index]! }));
      else if (index >= after.length) entries.push(Object.freeze({ path, change: "removed", before: before[index]! }));
      else entries.push(...diffJson(before[index]!, after[index]!, path));
    }
    return Object.freeze(entries);
  }
  return Object.freeze([Object.freeze({ path: prefix, change: "replaced", before, after })]);
}

export function parsePointer(pointer: JsonPointer): readonly string[] {
  if (pointer === "") return [];
  if (!pointer.startsWith("/")) throw new TypeError(`invalid-json-pointer:${pointer}`);
  return pointer.slice(1).split("/").map((token) => token.replace(/~1/g, "/").replace(/~0/g, "~"));
}

export function escapeToken(token: string): string {
  return token.replace(/~/g, "~0").replace(/\//g, "~1");
}

type OperationOutcome = { readonly ok: true; readonly value: JsonValue } | { readonly ok: false; readonly reason: string };

function applyOperation(root: JsonValue, operation: FamDraftPatchOperation): OperationOutcome {
  let tokens: readonly string[];
  try {
    tokens = parsePointer(operation.path);
  } catch {
    return { ok: false, reason: `invalid-json-pointer:${operation.path}` };
  }
  if (tokens.length === 0) {
    if (operation.op === "remove") return { ok: false, reason: "root-remove-not-allowed" };
    return { ok: true, value: operation.value };
  }
  return mutate(root, tokens, operation);
}

function mutate(node: JsonValue, tokens: readonly string[], operation: FamDraftPatchOperation): OperationOutcome {
  const [token, ...rest] = tokens;
  if (token === undefined) return { ok: true, value: node };
  if (node === null || typeof node !== "object") return { ok: false, reason: `path-not-traversable:${escapeToken(token)}` };
  if (Array.isArray(node)) {
    const isLast = rest.length === 0;
    const index = arrayIndex(token, node.length, isLast && operation.op === "insert");
    if (index === undefined) return { ok: false, reason: `array-index-invalid:${token}` };
    const copy = [...node];
    if (!isLast) {
      if (index >= node.length) return { ok: false, reason: `path-not-found:${token}` };
      const child = mutate(node[index]!, rest, operation);
      if (!child.ok) return child;
      copy[index] = child.value;
      return { ok: true, value: copy };
    }
    if (operation.op === "insert") copy.splice(index, 0, operation.value);
    else if (operation.op === "set") { if (index >= node.length) return { ok: false, reason: `array-index-out-of-range:${token}` }; copy[index] = operation.value; }
    else { if (index >= node.length) return { ok: false, reason: `path-not-found:${token}` }; copy.splice(index, 1); }
    return { ok: true, value: copy };
  }
  const object = node as JsonObject;
  const exists = Object.prototype.hasOwnProperty.call(object, token);
  if (rest.length > 0) {
    if (!exists) return { ok: false, reason: `path-not-found:${escapeToken(token)}` };
    const child = mutate(object[token]!, rest, operation);
    if (!child.ok) return child;
    return { ok: true, value: withKey(object, token, child.value) };
  }
  if (operation.op === "remove") {
    if (!exists) return { ok: false, reason: `path-not-found:${escapeToken(token)}` };
    const { [token]: _removed, ...remaining } = object;
    return { ok: true, value: remaining };
  }
  if (operation.op === "insert" && exists) return { ok: false, reason: `key-already-exists:${escapeToken(token)}` };
  if (operation.op === "set" && !exists) return { ok: false, reason: `path-not-found:${escapeToken(token)}` };
  return { ok: true, value: withKey(object, token, operation.value) };
}

/** key順を保持したまま1 keyだけ置換／追加する。 */
function withKey(object: JsonObject, key: string, value: JsonValue): JsonObject {
  const next: Record<string, JsonValue> = {};
  let placed = false;
  for (const [existingKey, existingValue] of Object.entries(object)) {
    if (existingKey === key) { next[key] = value; placed = true; } else next[existingKey] = existingValue;
  }
  if (!placed) next[key] = value;
  return next;
}

function arrayIndex(token: string, length: number, allowEnd = false): number | undefined {
  if (token === "-") return allowEnd ? length : undefined;
  if (!/^(0|[1-9]\d*)$/.test(token)) return undefined;
  const index = Number(token);
  return index <= length ? index : undefined;
}

function walk(value: JsonValue, pointer: JsonPointer, visit: (pointer: JsonPointer, node: JsonValue) => void): void {
  visit(pointer, value);
  if (Array.isArray(value)) value.forEach((child, index) => walk(child, `${pointer}/${index}`, visit));
  else if (isObject(value)) for (const [key, child] of Object.entries(value)) walk(child, `${pointer}/${escapeToken(key)}`, visit);
}

function countPaths(value: JsonValue): number {
  return listPointers(value).length;
}

function rejected(document: EditableFamDocument, index: number, reason: string, options: PreviewFamDraftOptions): FamDraftResult {
  const validation = document.parse === "parsed" ? options.validate?.(document.value) : undefined;
  return Object.freeze({
    document,
    diff: Object.freeze([]),
    receipt: Object.freeze({ ...receipt("rejected", 0, [], document.parse === "parsed" ? countPaths(document.value) : 0, validation, []), rejectedOperation: Object.freeze({ index, reason }) }),
    ...(validation ? { validation } : {}),
  });
}

function receipt(
  status: FamDraftReceipt["status"],
  appliedOperations: number,
  touchedPaths: readonly JsonPointer[],
  retainedUntouchedPaths: number,
  validation: ValidationResultLike | undefined,
  loss: readonly FamLossEntry[],
): FamDraftReceipt {
  return Object.freeze({
    schemaVersion: FAM_DRAFT_RECEIPT_SCHEMA_VERSION,
    status,
    appliedOperations,
    touchedPaths: Object.freeze([...touchedPaths]),
    retainedUntouchedPaths,
    ...(validation ? { validation: Object.freeze({ valid: validation.valid, issueCount: validation.issues.length }) } : {}),
    loss: Object.freeze([...loss]),
  });
}

function deepEqual(left: JsonValue, right: JsonValue): boolean {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((item, index) => deepEqual(item, right[index]!));
  if (isObject(left) && isObject(right)) {
    const leftKeys = Object.keys(left);
    return leftKeys.length === Object.keys(right).length && leftKeys.every((key) => key in right && deepEqual(left[key]!, right[key]!));
  }
  return false;
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T extends JsonValue>(value: T): T {
  if (Array.isArray(value)) { for (const child of value) deepFreeze(child); return Object.freeze(value) as T; }
  if (isObject(value)) { for (const child of Object.values(value)) deepFreeze(child); return Object.freeze(value) as T; }
  return value;
}

/**
 * diffからpatchを合成する。replaced→set、added→insert、removed→remove。
 * 配列indexのずれを避けるため、removeはpath降順で最後に適用する。
 */
export function patchFromDiff(diff: readonly FamDiffEntry[]): FamDraftPatch {
  const sets = diff.filter((entry) => entry.change === "replaced").map((entry): FamDraftPatchOperation => ({ op: "set", path: entry.path, value: entry.after ?? null }));
  const inserts = diff.filter((entry) => entry.change === "added").map((entry): FamDraftPatchOperation => ({ op: "insert", path: entry.path, value: entry.after ?? null }));
  const removes = [...diff.filter((entry) => entry.change === "removed")]
    .sort((left, right) => comparePointerDescending(left.path, right.path))
    .map((entry): FamDraftPatchOperation => ({ op: "remove", path: entry.path }));
  return createFamDraftPatch([...sets, ...inserts, ...removes]);
}

function comparePointerDescending(left: JsonPointer, right: JsonPointer): number {
  const leftTokens = parsePointer(left);
  const rightTokens = parsePointer(right);
  const length = Math.max(leftTokens.length, rightTokens.length);
  for (let index = 0; index < length; index += 1) {
    const l = leftTokens[index];
    const r = rightTokens[index];
    if (l === r) continue;
    if (l === undefined) return 1;
    if (r === undefined) return -1;
    const ln = /^\d+$/.test(l) ? Number(l) : undefined;
    const rn = /^\d+$/.test(r) ? Number(r) : undefined;
    if (ln !== undefined && rn !== undefined) return rn - ln;
    return r.localeCompare(l);
  }
  return 0;
}

export interface PointerLine { readonly pointer: JsonPointer; readonly line: number }
export interface PointerLineRender { readonly text: string; readonly lines: readonly PointerLine[] }

/**
 * JSONを整形しつつ各pointerの開始行（0始まり）を記録する。
 * RAW editorのpath navigationとunsupported field jumpに使う。
 */
export function renderPointerLines(value: JsonValue, indent = 2): PointerLineRender {
  const out: string[] = [];
  const lines: PointerLine[] = [];
  const pad = (depth: number) => " ".repeat(indent * depth);
  const emit = (node: JsonValue, pointer: JsonPointer, depth: number, prefix: string, suffix: string) => {
    lines.push({ pointer, line: out.length });
    if (Array.isArray(node)) {
      if (node.length === 0) { out.push(`${pad(depth)}${prefix}[]${suffix}`); return; }
      out.push(`${pad(depth)}${prefix}[`);
      node.forEach((child, index) => emit(child, `${pointer}/${index}`, depth + 1, "", index < node.length - 1 ? "," : ""));
      out.push(`${pad(depth)}]${suffix}`);
      return;
    }
    if (isObject(node)) {
      const keys = Object.keys(node);
      if (keys.length === 0) { out.push(`${pad(depth)}${prefix}{}${suffix}`); return; }
      out.push(`${pad(depth)}${prefix}{`);
      keys.forEach((key, index) => emit(node[key]!, `${pointer}/${escapeToken(key)}`, depth + 1, `${JSON.stringify(key)}: `, index < keys.length - 1 ? "," : ""));
      out.push(`${pad(depth)}}${suffix}`);
      return;
    }
    out.push(`${pad(depth)}${prefix}${JSON.stringify(node)}${suffix}`);
  };
  emit(value, "", 0, "", "");
  return Object.freeze({ text: `${out.join("\n")}\n`, lines: Object.freeze(lines) });
}
