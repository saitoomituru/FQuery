import { classifyWithAccessMap, type AccessMapProfile, type ClassificationBinding } from "./access-map.js";
import type { FamJsonRecord, FamNode, JsonObject } from "./index.js";

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
