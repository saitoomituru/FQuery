import type { FamJsonRecord, JsonObject } from "./index.js";

export interface AccessMapRule {
  readonly ruleId: string;
  readonly sourceClaimKind: string;
  readonly targetDimensionRef: string;
  readonly claimScopeRef: string;
  readonly evidenceScope: readonly string[];
}

export interface AccessMapProfile {
  readonly famId: string;
  readonly revisionId: string;
  readonly sourceFoldRef: string;
  readonly sourceRegistryRef: string;
  readonly targetFoldRef: string;
  readonly targetDimensionRefs: readonly string[];
  readonly registryRef: string;
  readonly unknownPolicy: "retain";
  readonly unmappedPolicy: "retain-unmapped";
  readonly rules: readonly AccessMapRule[];
  readonly factExtractors: readonly AccessMapFactExtractor[];
  readonly causalGates: readonly AccessMapCausalGate[];
  readonly semanticTopologyContract?: AccessMapSemanticTopologyContract;
}

/** provider固有fieldをcanonical semantic topologyへ読むためのprofile注入契約。 */
export interface AccessMapSemanticTopologyContract {
  readonly branchesPointer: string;
  readonly selectedBranchRef: string;
  readonly selectionScopeRef: string;
  readonly fields: {
    readonly branchRef: string;
    readonly observerRef: string;
    readonly relations: string;
    readonly fromUnitRef: string;
    readonly toUnitRef: string;
    readonly axis: string;
    readonly relationKind: string;
    readonly evidenceRefs: string;
  };
}

export interface SemanticTopologyRelation {
  readonly fromUnitRef: string;
  readonly toUnitRef: string;
  readonly axis: "L" | "mL";
  readonly relationKind: "dependency" | "causal" | "conditional" | "parent-child";
  readonly evidenceRefs: readonly string[];
}

export interface SemanticTopologyBranch {
  readonly branchRef: string;
  readonly observerRef: string;
  readonly relations: readonly SemanticTopologyRelation[];
}

export interface SemanticTopologyProjection {
  readonly status: "contract-not-declared" | "topology-not-declared" | "selected" | "selected-branch-not-found";
  readonly selectionScopeRef?: string;
  readonly branches: readonly SemanticTopologyBranch[];
  readonly selectedBranch?: SemanticTopologyBranch;
}

export interface AccessMapFactExtractor {
  readonly extractorRef: string;
  readonly sourceUnitOrder: number;
  readonly factKey: string;
  readonly pattern: string;
  readonly valueType: "number";
  readonly scopeRef: string;
}

export interface AccessMapCausalGate {
  readonly gateRef: string;
  readonly sourceUnitOrder: number;
  readonly factPath: readonly string[];
  readonly conditionKind: "number-gte";
  readonly threshold: number;
  readonly activeUnitOrders: readonly number[];
  readonly fallbackUnitOrders: readonly number[];
  readonly conditionScopeRef: string;
}

export interface ClassificationBinding {
  readonly status: "mapped" | "unmapped";
  readonly sourceClaimKind: string;
  readonly accessMapFamRef: string;
  readonly accessMapRevisionRef: string;
  readonly registryRef: string;
  readonly targetFoldRef: string;
  readonly dimensionRef?: string;
  readonly claimScopeRef?: string;
  readonly evidenceScope: readonly string[];
}

export function readAccessMapProfile(value: FamJsonRecord): AccessMapProfile {
  if (value.kind !== "access-map") throw new TypeError("access-map-kind-required");
  const psi = requiredObject(value.ψ, "$.ψ");
  const gradient = requiredObject(value["∇φ"], "$.∇φ");
  const lambda = requiredObject(value.λ, "$.λ");
  const q = requiredObject(value.Q, "$.Q");
  const rulesValue = requiredArray(gradient.mapping_rules, "$.∇φ.mapping_rules");
  const rules = rulesValue.map((candidate, index) => readRule(candidate, `$.∇φ.mapping_rules[${index}]`));
  const factExtractors = optionalArray(gradient.fact_extractors).map((candidate, index) => readFactExtractor(candidate, `$.∇φ.fact_extractors[${index}]`));
  const causalGates = optionalArray(gradient.causal_gates).map((candidate, index) => readCausalGate(candidate, `$.∇φ.causal_gates[${index}]`));
  const semanticTopologyContract = gradient.semantic_topology_contract === undefined
    ? undefined
    : readSemanticTopologyContract(gradient.semantic_topology_contract, "$.∇φ.semantic_topology_contract");
  if (rules.length === 0) throw new TypeError("access-map-rules-required");
  const ids = new Set<string>();
  const claims = new Set<string>();
  for (const rule of rules) {
    if (ids.has(rule.ruleId)) throw new TypeError(`access-map-rule-id-duplicate:${rule.ruleId}`);
    if (claims.has(rule.sourceClaimKind)) throw new TypeError(`access-map-claim-kind-ambiguous:${rule.sourceClaimKind}`);
    ids.add(rule.ruleId);
    claims.add(rule.sourceClaimKind);
  }
  if (q.unknown_policy !== "retain") throw new TypeError("access-map-unknown-policy-must-retain");
  if (q.unmapped_policy !== "retain-unmapped") throw new TypeError("access-map-unmapped-policy-must-retain");
  if (q.source_mutation !== false || gradient.source_mutation !== false) throw new TypeError("access-map-source-mutation-must-be-false");
  return Object.freeze({
    famId: value.fam_id,
    revisionId: value.revision_id,
    sourceFoldRef: requiredString(psi.source_fold_ref, "$.ψ.source_fold_ref"),
    sourceRegistryRef: requiredString(psi.source_registry_ref, "$.ψ.source_registry_ref"),
    targetFoldRef: requiredString(lambda.target_fold_ref, "$.λ.target_fold_ref"),
    targetDimensionRefs: freezeStrings(requiredArray(lambda.target_dimension_refs, "$.λ.target_dimension_refs"), "$.λ.target_dimension_refs"),
    registryRef: requiredString(q.registry_ref, "$.Q.registry_ref"),
    unknownPolicy: "retain",
    unmappedPolicy: "retain-unmapped",
    rules: Object.freeze(rules),
    factExtractors: Object.freeze(factExtractors),
    causalGates: Object.freeze(causalGates),
    ...(semanticTopologyContract ? { semanticTopologyContract } : {}),
  });
}

/**
 * profileが宣言したpathとfield名だけを使ってsemantic topologyを読む。
 * Coreは自然言語、unit順、World分類から因果や親子を推測しない。
 */
export function projectSemanticTopology(value: FamJsonRecord, profile: AccessMapProfile): SemanticTopologyProjection {
  const contract = profile.semanticTopologyContract;
  if (!contract) return Object.freeze({ status: "contract-not-declared", branches: Object.freeze([]) });
  const raw = atJsonPointer(value, contract.branchesPointer);
  if (raw === undefined) return Object.freeze({ status: "topology-not-declared", selectionScopeRef: contract.selectionScopeRef, branches: Object.freeze([]) });
  const branchValues = requiredArray(raw, contract.branchesPointer);
  const unitRefs = new Set(readOutputUnitRefs(value));
  const branches = branchValues.map((candidate, index) => readSemanticTopologyBranch(candidate, `${contract.branchesPointer}[${index}]`, contract, unitRefs));
  const branchRefs = new Set<string>();
  for (const branch of branches) {
    if (branchRefs.has(branch.branchRef)) throw new TypeError(`semantic-topology-branch-ref-duplicate:${branch.branchRef}`);
    branchRefs.add(branch.branchRef);
  }
  const selectedBranch = branches.find((branch) => branch.branchRef === contract.selectedBranchRef);
  return Object.freeze({
    status: selectedBranch ? "selected" : "selected-branch-not-found",
    selectionScopeRef: contract.selectionScopeRef,
    branches: Object.freeze(branches),
    ...(selectedBranch ? { selectedBranch } : {}),
  });
}

/** 明示claim kindだけを写像する。本文からWorld／Astral等を推論しない。 */
export function classifyWithAccessMap(profile: AccessMapProfile, sourceClaimKind: string): ClassificationBinding {
  const rule = profile.rules.find((candidate) => candidate.sourceClaimKind === sourceClaimKind);
  const base = {
    sourceClaimKind,
    accessMapFamRef: profile.famId,
    accessMapRevisionRef: profile.revisionId,
    registryRef: profile.registryRef,
    targetFoldRef: profile.targetFoldRef,
  };
  if (!rule) return Object.freeze({ ...base, status: "unmapped", evidenceScope: Object.freeze(["unknown", "not-absence"]) });
  return Object.freeze({
    ...base,
    status: "mapped",
    dimensionRef: rule.targetDimensionRef,
    claimScopeRef: rule.claimScopeRef,
    evidenceScope: rule.evidenceScope,
  });
}

function readRule(value: unknown, path: string): AccessMapRule {
  const rule = requiredObject(value, path);
  return Object.freeze({
    ruleId: requiredString(rule.rule_id, `${path}.rule_id`),
    sourceClaimKind: requiredString(rule.source_claim_kind, `${path}.source_claim_kind`),
    targetDimensionRef: requiredString(rule.target_dimension_ref, `${path}.target_dimension_ref`),
    claimScopeRef: requiredString(rule.claim_scope_ref, `${path}.claim_scope_ref`),
    evidenceScope: freezeStrings(requiredArray(rule.evidence_scope, `${path}.evidence_scope`), `${path}.evidence_scope`),
  });
}

function readFactExtractor(value: unknown, path: string): AccessMapFactExtractor {
  const extractor = requiredObject(value, path);
  if (extractor.value_type !== "number") throw new TypeError(`${path}.value_type:number-required`);
  const pattern = requiredString(extractor.pattern, `${path}.pattern`);
  try { new RegExp(pattern, "u"); } catch { throw new TypeError(`${path}.pattern:invalid-regexp`); }
  return Object.freeze({
    extractorRef: requiredString(extractor.extractor_ref, `${path}.extractor_ref`),
    sourceUnitOrder: requiredNonNegativeInteger(extractor.source_unit_order, `${path}.source_unit_order`),
    factKey: requiredString(extractor.fact_key, `${path}.fact_key`),
    pattern,
    valueType: "number",
    scopeRef: requiredString(extractor.scope_ref, `${path}.scope_ref`),
  });
}

function readCausalGate(value: unknown, path: string): AccessMapCausalGate {
  const gate = requiredObject(value, path);
  if (gate.condition_kind !== "number-gte") throw new TypeError(`${path}.condition_kind:number-gte-required`);
  if (typeof gate.threshold !== "number" || !Number.isFinite(gate.threshold)) throw new TypeError(`${path}.threshold:number-required`);
  return Object.freeze({
    gateRef: requiredString(gate.gate_ref, `${path}.gate_ref`),
    sourceUnitOrder: requiredNonNegativeInteger(gate.source_unit_order, `${path}.source_unit_order`),
    factPath: freezeStrings(requiredArray(gate.fact_path, `${path}.fact_path`), `${path}.fact_path`),
    conditionKind: "number-gte",
    threshold: gate.threshold,
    activeUnitOrders: freezeIntegers(requiredArray(gate.active_unit_orders, `${path}.active_unit_orders`), `${path}.active_unit_orders`),
    fallbackUnitOrders: freezeIntegers(requiredArray(gate.fallback_unit_orders, `${path}.fallback_unit_orders`), `${path}.fallback_unit_orders`),
    conditionScopeRef: requiredString(gate.condition_scope_ref, `${path}.condition_scope_ref`),
  });
}

function readSemanticTopologyContract(value: unknown, path: string): AccessMapSemanticTopologyContract {
  const contract = requiredObject(value, path);
  const fields = requiredObject(contract.fields, `${path}.fields`);
  const branchesPointer = requiredString(contract.branches_pointer, `${path}.branches_pointer`);
  if (!branchesPointer.startsWith("/")) throw new TypeError(`${path}.branches_pointer:json-pointer-required`);
  return Object.freeze({
    branchesPointer,
    selectedBranchRef: requiredString(contract.selected_branch_ref, `${path}.selected_branch_ref`),
    selectionScopeRef: requiredString(contract.selection_scope_ref, `${path}.selection_scope_ref`),
    fields: Object.freeze({
      branchRef: requiredString(fields.branch_ref, `${path}.fields.branch_ref`),
      observerRef: requiredString(fields.observer_ref, `${path}.fields.observer_ref`),
      relations: requiredString(fields.relations, `${path}.fields.relations`),
      fromUnitRef: requiredString(fields.from_unit_ref, `${path}.fields.from_unit_ref`),
      toUnitRef: requiredString(fields.to_unit_ref, `${path}.fields.to_unit_ref`),
      axis: requiredString(fields.axis, `${path}.fields.axis`),
      relationKind: requiredString(fields.relation_kind, `${path}.fields.relation_kind`),
      evidenceRefs: requiredString(fields.evidence_refs, `${path}.fields.evidence_refs`),
    }),
  });
}

function readSemanticTopologyBranch(value: unknown, path: string, contract: AccessMapSemanticTopologyContract, unitRefs: ReadonlySet<string>): SemanticTopologyBranch {
  const branch = requiredObject(value, path);
  const relations = requiredArray(branch[contract.fields.relations], `${path}.${contract.fields.relations}`).map((candidate, index) => {
    const relationPath = `${path}.${contract.fields.relations}[${index}]`;
    const relation = requiredObject(candidate, relationPath);
    const fromUnitRef = requiredString(relation[contract.fields.fromUnitRef], `${relationPath}.${contract.fields.fromUnitRef}`);
    const toUnitRef = requiredString(relation[contract.fields.toUnitRef], `${relationPath}.${contract.fields.toUnitRef}`);
    if (!unitRefs.has(fromUnitRef) || !unitRefs.has(toUnitRef)) throw new TypeError(`${relationPath}:semantic-topology-unit-ref-not-found`);
    if (fromUnitRef === toUnitRef) throw new TypeError(`${relationPath}:semantic-topology-self-edge`);
    const axis = requiredString(relation[contract.fields.axis], `${relationPath}.${contract.fields.axis}`);
    if (axis !== "L" && axis !== "mL") throw new TypeError(`${relationPath}.${contract.fields.axis}:semantic-topology-axis-unsupported`);
    const relationKind = requiredString(relation[contract.fields.relationKind], `${relationPath}.${contract.fields.relationKind}`);
    if (!(["dependency", "causal", "conditional", "parent-child"] as const).includes(relationKind as never)) throw new TypeError(`${relationPath}.${contract.fields.relationKind}:semantic-topology-relation-kind-unsupported`);
    return Object.freeze({
      fromUnitRef,
      toUnitRef,
      axis,
      relationKind: relationKind as SemanticTopologyRelation["relationKind"],
      evidenceRefs: freezeStrings(requiredArray(relation[contract.fields.evidenceRefs], `${relationPath}.${contract.fields.evidenceRefs}`), `${relationPath}.${contract.fields.evidenceRefs}`),
    });
  });
  const relationKeys = new Set<string>();
  const containmentParentByChild = new Map<string, string>();
  for (const relation of relations) {
    const key = `${relation.fromUnitRef}\u0000${relation.toUnitRef}\u0000${relation.axis}\u0000${relation.relationKind}`;
    if (relationKeys.has(key)) throw new TypeError(`${path}:semantic-topology-relation-duplicate`);
    relationKeys.add(key);
    if (relation.relationKind !== "parent-child") continue;
    const previous = containmentParentByChild.get(relation.toUnitRef);
    if (previous && previous !== relation.fromUnitRef) throw new TypeError(`${path}:semantic-topology-multiple-containment-parents`);
    containmentParentByChild.set(relation.toUnitRef, relation.fromUnitRef);
  }
  assertAcyclic(relations);
  return Object.freeze({
    branchRef: requiredString(branch[contract.fields.branchRef], `${path}.${contract.fields.branchRef}`),
    observerRef: requiredString(branch[contract.fields.observerRef], `${path}.${contract.fields.observerRef}`),
    relations: Object.freeze(relations),
  });
}

function readOutputUnitRefs(value: FamJsonRecord): readonly string[] {
  const lambda = requiredObject(value.λ, "$.λ");
  return requiredArray(lambda.output_units, "$.λ.output_units").map((candidate, index) => {
    const unit = requiredObject(candidate, `$.λ.output_units[${index}]`);
    const q = requiredObject(unit.Q, `$.λ.output_units[${index}].Q`);
    return requiredString(q.unit_ref, `$.λ.output_units[${index}].Q.unit_ref`);
  });
}

function assertAcyclic(relations: readonly SemanticTopologyRelation[]): void {
  const outgoing = new Map<string, string[]>();
  for (const relation of relations) outgoing.set(relation.fromUnitRef, [...(outgoing.get(relation.fromUnitRef) ?? []), relation.toUnitRef]);
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (ref: string): void => {
    if (visiting.has(ref)) throw new TypeError("semantic-topology-cycle");
    if (visited.has(ref)) return;
    visiting.add(ref);
    for (const child of outgoing.get(ref) ?? []) visit(child);
    visiting.delete(ref);
    visited.add(ref);
  };
  for (const ref of outgoing.keys()) visit(ref);
}

function atJsonPointer(value: unknown, pointer: string): unknown {
  let current = value;
  for (const token of pointer.slice(1).split("/").map((entry) => entry.replaceAll("~1", "/").replaceAll("~0", "~"))) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[token];
  }
  return current;
}

function requiredObject(value: unknown, path: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${path}:object-required`);
  return value as JsonObject;
}

function requiredArray(value: unknown, path: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`${path}:array-required`);
  return value;
}

function optionalArray(value: unknown): readonly unknown[] {
  return value === undefined ? [] : requiredArray(value, "$.∇φ.optional-array");
}

function requiredNonNegativeInteger(value: unknown, path: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new TypeError(`${path}:non-negative-integer-required`);
  return value as number;
}

function freezeIntegers(value: readonly unknown[], path: string): readonly number[] {
  return Object.freeze(value.map((entry, index) => requiredNonNegativeInteger(entry, `${path}[${index}]`)));
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${path}:string-required`);
  return value;
}

function freezeStrings(value: readonly unknown[], path: string): readonly string[] {
  return Object.freeze(value.map((entry, index) => requiredString(entry, `${path}[${index}]`)));
}
