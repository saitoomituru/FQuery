import { readFamJson, validateFamDecomposition, type FamDocument, type FamNode, type JsonObject } from "@fquery/fam-core";
import { applyFamPatch, type FamChildDependency, type FamEditOptions, type FamPatchDecision } from "./index.js";

export interface FamUnitReplacementRequest {
  readonly operationId: string;
  readonly unitRef: string;
  readonly baseParentRevisionId: string;
  readonly resultParentRevisionId: string;
  readonly resultUnitRevisionRef: string;
  readonly replacementText: string;
  readonly claimKind: string;
  readonly overrideSourceRef: string;
  readonly overrideObserverRef: string;
  readonly childDependencies?: readonly FamChildDependency[];
}

export interface FamUnitReplacementResult {
  readonly decision: FamPatchDecision;
  readonly changedUnitRef: string;
  readonly unchangedUnitRefs: readonly string[];
  readonly revalidateChildRefs: readonly string[];
  readonly invalidatedDerivedPaths: readonly string[];
}

/** 選択unitだけをUser提供overrideとして置換し、元unitとparent revisionを変更しない。 */
export function replaceFamUnit(
  document: FamDocument,
  request: FamUnitReplacementRequest,
  options: FamEditOptions = {},
): FamUnitReplacementResult {
  const units = outputUnits(document);
  const index = units.findIndex((unit) => asObject(unit.Q)?.unit_ref === request.unitRef);
  if (index < 0) throw new TypeError(`unit-ref-not-found:${request.unitRef}`);
  const before = units[index]!;
  const beforePsi = requiredObject(before.ψ, "unit.ψ");
  const beforeQ = requiredObject(before.Q, "unit.Q");
  const beforeLambda = requiredObject(before.λ, "unit.λ");
  const previousSubSplitters = Array.isArray(beforeLambda.sub_splitters) ? beforeLambda.sub_splitters : [];
  const invalidatedDerivedPaths = previousSubSplitters.length > 0 ? ["/λ/sub_splitters"] : [];
  const beforeText = requiredString(beforePsi.source_text, "unit.ψ.source_text");
  if (!request.replacementText.trim()) throw new TypeError("replacement-text-required");
  const replacement: FamNode = {
    ...before,
    ψ: {
      ...beforePsi,
      source_text: request.replacementText,
      source_ref: request.overrideSourceRef,
      observation_status: "user-provided-override",
    },
    "∇φ": [{
      gradient_type: "user-override",
      source_expression: request.replacementText,
      source_language: beforePsi.source_language ?? "und",
      source_mutation: false,
    }],
    λ: {
      ...beforeLambda,
      manifestation: request.replacementText,
      // 翻訳写本などは旧source_textへ束縛されている。局所差替え後に
      // currentとして残さず、再生成・再評価されるまで空集合へ失効させる。
      sub_splitters: [],
    },
    Q: {
      ...beforeQ,
      unit_revision_ref: request.resultUnitRevisionRef,
      parent_revision_ref: request.resultParentRevisionId,
      claim_kind: request.claimKind,
      edit_origin: "user-override",
      override_source_ref: request.overrideSourceRef,
      override_observer_ref: request.overrideObserverRef,
      replaces_source_expression: beforeText,
      ...(previousSubSplitters.length > 0 ? {
        invalidated_derivations: [{
          path: "/λ/sub_splitters",
          reason: "source-unit-replaced-requires-revalidation",
          previous_count: previousSubSplitters.length,
          revalidation_status: "required",
        }],
      } : {}),
      unknowns: [],
      unknown_is_absence: false,
    },
    provenance: {
      ...(asObject(before.provenance) ?? {}),
      claim_scope: "USER_PROVIDED_OVERRIDE",
      source_refs: [request.overrideSourceRef],
      source_mutation: false,
    },
  };
  const decision = applyFamPatch(document, {
    operationId: request.operationId,
    baseRevisionId: request.baseParentRevisionId,
    resultRevisionId: request.resultParentRevisionId,
    patches: [{ op: "set", path: `/λ/output_units/${index}`, value: replacement }],
  }, { ...options, validate: options.validate ?? validateFamDecomposition });
  const path = `/λ/output_units/${index}`;
  const revalidateChildRefs = request.childDependencies?.filter((dependency) => dependency.observedParentPaths.some((observed) => pointersOverlap(path, observed))).map((dependency) => dependency.childRef) ?? [];
  return Object.freeze({
    decision,
    changedUnitRef: request.unitRef,
    unchangedUnitRefs: Object.freeze(units.flatMap((unit) => asObject(unit.Q)?.unit_ref !== request.unitRef && typeof asObject(unit.Q)?.unit_ref === "string" ? [asObject(unit.Q)!.unit_ref as string] : [])),
    revalidateChildRefs: Object.freeze(revalidateChildRefs),
    invalidatedDerivedPaths: Object.freeze(invalidatedDerivedPaths),
  });
}

export class FamRevisionStore {
  readonly #documents = new Map<string, FamDocument>();

  append(document: FamDocument): void {
    const key = keyFor(document.value.fam_id, document.value.revision_id);
    if (this.#documents.has(key)) throw new Error(`fam-revision-already-stored:${document.value.revision_id}`);
    this.#documents.set(key, document);
  }

  get(famId: string, revisionId: string): FamDocument | undefined {
    return this.#documents.get(keyFor(famId, revisionId));
  }

  appendDecision(decision: FamPatchDecision): void {
    if (decision.status === "accepted") this.append(decision.document);
  }

  revisions(famId: string): readonly string[] {
    return Object.freeze([...this.#documents.values()].filter((document) => document.value.fam_id === famId).map((document) => document.value.revision_id));
  }
}

function outputUnits(document: FamDocument): readonly FamNode[] {
  const lambda = requiredObject(document.value.λ, "$.λ");
  if (!Array.isArray(lambda.output_units)) throw new TypeError("decomposition-output-units-required");
  return lambda.output_units.map((unit, index) => requiredObject(unit, `$.λ.output_units[${index}]`) as FamNode);
}

function requiredObject(value: unknown, path: string): JsonObject {
  const object = asObject(value);
  if (!object) throw new TypeError(`${path}:object-required`);
  return object;
}

function asObject(value: unknown): JsonObject | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : undefined;
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || !value) throw new TypeError(`${path}:string-required`);
  return value;
}

function pointersOverlap(left: string, right: string): boolean {
  return left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`);
}

function keyFor(famId: string, revisionId: string): string {
  return `${famId}\u0000${revisionId}`;
}
