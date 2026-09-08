import { classifyWithAccessMap, type AccessMapProfile, type ClassificationBinding } from "./access-map.js";
import type { FamJsonRecord, FamNode, JsonObject } from "./index.js";

export const DECOMPOSITION_PROFILE_INVARIANT_REF = "profile://fquery/decomposition-invariants@0.1.0-draft" as const;

export interface DecompositionProfileNormalization {
  readonly value: FamJsonRecord;
  readonly repairedPaths: readonly string[];
  readonly profileRef: typeof DECOMPOSITION_PROFILE_INVARIANT_REF;
}

export interface DecompositionUnitProjection {
  readonly unitRef: string;
  readonly unitRevisionRef: string;
  readonly parentFamRef: string;
  readonly parentRevisionRef: string;
  readonly order: number;
  readonly sourcePointer: string;
  readonly claimKind: string;
  readonly classification: ClassificationBinding;
  readonly value: FamNode;
}

/** providerが返した分解FAMへFQuery profileのstable unit identityを補う。既存identityとsource objectは変更しない。 */
export function stampDecompositionUnitIdentity(value: FamJsonRecord): FamJsonRecord {
  if (value.kind !== "decomposition") return value;
  const lambda = asObject(value.λ);
  const units = Array.isArray(lambda?.output_units) ? lambda.output_units : undefined;
  if (!units) return value;
  const nextUnits = units.map((candidate, index) => {
    const unit = asObject(candidate);
    const q = asObject(unit?.Q);
    if (!unit || !q) return candidate;
    const unitRef = stringValue(q.unit_ref) ?? `${value.fam_id}/unit/${index + 1}`;
    return {
      ...unit,
      Q: {
        ...q,
        unit_ref: unitRef,
        unit_revision_ref: stringValue(q.unit_revision_ref) ?? `${unitRef}/revision/1`,
        parent_fam_ref: stringValue(q.parent_fam_ref) ?? value.fam_id,
        parent_revision_ref: stringValue(q.parent_revision_ref) ?? value.revision_id,
        unit_order: typeof q.unit_order === "number" ? q.unit_order : index,
        claim_kind: stringValue(q.claim_kind) ?? "unknown",
      },
    };
  });
  return Object.freeze({ ...value, λ: Object.freeze({ ...lambda, output_units: Object.freeze(nextUnits) }) }) as FamJsonRecord;
}

/** provider候補へFQuery profile所有の不変条件だけを適用し、意味内容やunknownsは生成しない。 */
export function normalizeDecompositionProfileInvariants(value: FamJsonRecord): DecompositionProfileNormalization {
  const repairedPaths: string[] = [];
  const profiled = value.kind === "decomposition"
    ? value
    : Object.freeze({ ...value, kind: "decomposition" }) as FamJsonRecord;
  if (profiled !== value) repairedPaths.push("$.kind");
  const identified = stampDecompositionUnitIdentity(profiled);
  repairedPaths.push(...identityRepairPaths(profiled, identified));
  const normalized = normalizeFamNodes(identified, "$", repairedPaths) as FamJsonRecord;
  return Object.freeze({ value: normalized, repairedPaths: Object.freeze(repairedPaths), profileRef: DECOMPOSITION_PROFILE_INVARIANT_REF });
}

function identityRepairPaths(before: FamJsonRecord, after: FamJsonRecord): string[] {
  const beforeUnits = asObject(before.λ)?.output_units;
  const afterUnits = asObject(after.λ)?.output_units;
  if (!Array.isArray(beforeUnits) || !Array.isArray(afterUnits)) return [];
  const fields = ["unit_ref", "unit_revision_ref", "parent_fam_ref", "parent_revision_ref", "unit_order", "claim_kind"] as const;
  const paths: string[] = [];
  afterUnits.forEach((candidate, index) => {
    const beforeQ = asObject(asObject(beforeUnits[index])?.Q);
    const afterQ = asObject(asObject(candidate)?.Q);
    if (!beforeQ || !afterQ) return;
    for (const field of fields) {
      if (beforeQ[field] !== afterQ[field]) paths.push(`$.λ.output_units[${index}].Q.${field}`);
    }
  });
  return paths;
}

export function projectDecompositionUnits(value: FamJsonRecord, accessMap: AccessMapProfile): readonly DecompositionUnitProjection[] {
  if (value.kind !== "decomposition") throw new TypeError("decomposition-kind-required");
  const lambda = requiredObject(value.λ, "$.λ");
  if (!Array.isArray(lambda.output_units)) throw new TypeError("decomposition-output-units-required");
  const seen = new Set<string>();
  const projections = lambda.output_units.map((candidate, index): DecompositionUnitProjection => {
    const unit = requiredObject(candidate, `$.λ.output_units[${index}]`);
    const q = requiredObject(unit.Q, `$.λ.output_units[${index}].Q`);
    const unitRef = requiredString(q.unit_ref, `$.λ.output_units[${index}].Q.unit_ref`);
    if (seen.has(unitRef)) throw new TypeError(`decomposition-unit-ref-duplicate:${unitRef}`);
    seen.add(unitRef);
    const claimKind = requiredString(q.claim_kind, `$.λ.output_units[${index}].Q.claim_kind`);
    return Object.freeze({
      unitRef,
      unitRevisionRef: requiredString(q.unit_revision_ref, `$.λ.output_units[${index}].Q.unit_revision_ref`),
      parentFamRef: requiredString(q.parent_fam_ref, `$.λ.output_units[${index}].Q.parent_fam_ref`),
      parentRevisionRef: requiredString(q.parent_revision_ref, `$.λ.output_units[${index}].Q.parent_revision_ref`),
      order: requiredNumber(q.unit_order, `$.λ.output_units[${index}].Q.unit_order`),
      sourcePointer: `/λ/output_units/${index}`,
      claimKind,
      classification: classifyWithAccessMap(accessMap, claimKind),
      value: unit as FamNode,
    });
  });
  return Object.freeze(projections.sort((left, right) => left.order - right.order));
}

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}

function normalizeFamNodes(value: unknown, path: string, repairedPaths: string[]): unknown {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((child, index) => {
      const normalized = normalizeFamNodes(child, `${path}[${index}]`, repairedPaths);
      if (normalized !== child) changed = true;
      return normalized;
    });
    return changed ? Object.freeze(next) : value;
  }
  const object = asObject(value);
  if (!object) return value;
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(object)) {
    const normalized = normalizeFamNodes(child, `${path}.${key}`, repairedPaths);
    next[key] = normalized;
    if (normalized !== child) changed = true;
  }
  if (asObject(object.ψ) && Array.isArray(object["∇φ"]) && asObject(object.λ) && asObject(object.Q)) {
    const q = asObject(next.Q)!;
    if (q.unknown_is_absence !== false) {
      next.Q = Object.freeze({ ...q, unknown_is_absence: false });
      repairedPaths.push(`${path}.Q.unknown_is_absence`);
      changed = true;
    }
  }
  return changed ? Object.freeze(next) : value;
}

function requiredObject(value: unknown, path: string): JsonObject {
  const object = asObject(value);
  if (!object) throw new TypeError(`${path}:object-required`);
  return object;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function requiredString(value: unknown, path: string): string {
  const result = stringValue(value);
  if (!result) throw new TypeError(`${path}:string-required`);
  return result;
}

function requiredNumber(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new TypeError(`${path}:non-negative-integer-required`);
  return value as number;
}
