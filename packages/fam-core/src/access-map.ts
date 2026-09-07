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
  return Object.freeze({
    extractorRef: requiredString(extractor.extractor_ref, `${path}.extractor_ref`),
    sourceUnitOrder: requiredNonNegativeInteger(extractor.source_unit_order, `${path}.source_unit_order`),
    factKey: requiredString(extractor.fact_key, `${path}.fact_key`),
    pattern: requiredString(extractor.pattern, `${path}.pattern`),
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
