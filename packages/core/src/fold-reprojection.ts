export type FoldProjectionStatus = "fresh" | "needs-recomposition" | "unknown";

export interface FoldProjectionNode {
  readonly foldRef: string;
  readonly order: number;
  readonly manifestation: string;
  readonly facts?: Readonly<Record<string, unknown>>;
  readonly branch?: { readonly gateRef: string; readonly role: "active" | "fallback" };
}

export interface FoldDependencyEdge {
  readonly edgeRef: string;
  readonly fromFoldRef: string;
  readonly toFoldRef: string;
  readonly relation: "dependency" | "causal" | "parent-child";
}

export type FoldCondition = {
  readonly kind: "number-gte";
  readonly path: readonly string[];
  readonly threshold: number;
};

export interface FoldConditionGate {
  readonly gateRef: string;
  readonly sourceFoldRef: string;
  readonly condition: FoldCondition;
  readonly activeFoldRefs: readonly string[];
  readonly fallbackFoldRefs: readonly string[];
  /** fixtureまたは注入Access Map内で宣言された局所条件。普遍因果法則ではない。 */
  readonly conditionScopeRef: string;
}

export interface FoldEdgeEvaluation {
  readonly gateRef: string;
  readonly conditionScopeRef: string;
  readonly status: "retained" | "cancelled" | "unknown";
  readonly selectedRole?: "active" | "fallback";
  readonly selectedFoldRefs: readonly string[];
  readonly recompositionRequired: boolean;
}

export interface FoldReprojectionInput {
  readonly nodes: readonly FoldProjectionNode[];
  readonly dependencies: readonly FoldDependencyEdge[];
  readonly gates: readonly FoldConditionGate[];
  readonly changedFoldRefs: readonly string[];
}

export interface FoldReprojectionResult {
  readonly projectionStatus: FoldProjectionStatus;
  readonly stale: boolean;
  readonly affectedFoldRefs: readonly string[];
  readonly activeFoldRefs: readonly string[];
  readonly manifestations: readonly string[];
  readonly edgeEvaluations: readonly FoldEdgeEvaluation[];
  readonly cancelledGateRefs: readonly string[];
  readonly selectedFallbackRefs: readonly string[];
}

/**
 * 注入済みの明示graphだけを評価する。本文から因果やfallbackを推論せず、
 * 条件不明またはfallback欠損時はstale projectionを最新結果として返さない。
 */
export function reprojectFoldGraph(input: FoldReprojectionInput): FoldReprojectionResult {
  validateGraph(input);
  const affected = affectedSubgraph(input);
  const evaluations = input.gates.map((gate) => evaluateGate(gate, input.nodes));
  const needsRecomposition = evaluations.some((entry) => entry.recompositionRequired);
  const hasUnknown = evaluations.some((entry) => entry.status === "unknown");
  const projectionStatus: FoldProjectionStatus = needsRecomposition ? "needs-recomposition" : hasUnknown ? "unknown" : "fresh";
  const selectedByGate = new Map(evaluations.map((entry) => [entry.gateRef, new Set(entry.selectedFoldRefs)]));
  const activeNodes = input.nodes
    .filter((node) => !node.branch || selectedByGate.get(node.branch.gateRef)?.has(node.foldRef))
    .sort((left, right) => left.order - right.order);
  return Object.freeze({
    projectionStatus,
    stale: projectionStatus !== "fresh",
    affectedFoldRefs: Object.freeze(affected),
    activeFoldRefs: Object.freeze(activeNodes.map((node) => node.foldRef)),
    manifestations: projectionStatus === "fresh" ? Object.freeze(activeNodes.map((node) => node.manifestation)) : Object.freeze([]),
    edgeEvaluations: Object.freeze(evaluations),
    cancelledGateRefs: Object.freeze(evaluations.filter((entry) => entry.status === "cancelled").map((entry) => entry.gateRef)),
    selectedFallbackRefs: Object.freeze(evaluations.flatMap((entry) => entry.selectedRole === "fallback" ? entry.selectedFoldRefs : [])),
  });
}

function evaluateGate(gate: FoldConditionGate, nodes: readonly FoldProjectionNode[]): FoldEdgeEvaluation {
  const source = nodes.find((node) => node.foldRef === gate.sourceFoldRef)!;
  const value = valueAt(source.facts, gate.condition.path);
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return freezeEvaluation(gate, "unknown", undefined, [], true);
  }
  if (value >= gate.condition.threshold) {
    return freezeEvaluation(gate, "retained", "active", gate.activeFoldRefs, false);
  }
  if (gate.fallbackFoldRefs.length > 0) {
    return freezeEvaluation(gate, "cancelled", "fallback", gate.fallbackFoldRefs, false);
  }
  return freezeEvaluation(gate, "cancelled", undefined, [], true);
}

function freezeEvaluation(
  gate: FoldConditionGate,
  status: FoldEdgeEvaluation["status"],
  selectedRole: FoldEdgeEvaluation["selectedRole"],
  selectedFoldRefs: readonly string[],
  recompositionRequired: boolean,
): FoldEdgeEvaluation {
  return Object.freeze({
    gateRef: gate.gateRef,
    conditionScopeRef: gate.conditionScopeRef,
    status,
    ...(selectedRole ? { selectedRole } : {}),
    selectedFoldRefs: Object.freeze([...selectedFoldRefs]),
    recompositionRequired,
  });
}

function affectedSubgraph(input: FoldReprojectionInput): string[] {
  const adjacency = new Map<string, Set<string>>();
  const connect = (from: string, to: string) => {
    const targets = adjacency.get(from) ?? new Set<string>();
    targets.add(to);
    adjacency.set(from, targets);
  };
  for (const edge of input.dependencies) connect(edge.fromFoldRef, edge.toFoldRef);
  for (const gate of input.gates) for (const target of [...gate.activeFoldRefs, ...gate.fallbackFoldRefs]) connect(gate.sourceFoldRef, target);
  const queue = input.changedFoldRefs.length > 0 ? [...input.changedFoldRefs] : input.nodes.map((node) => node.foldRef);
  const affected = new Set<string>();
  while (queue.length > 0) {
    const ref = queue.shift()!;
    if (affected.has(ref)) continue;
    affected.add(ref);
    for (const target of adjacency.get(ref) ?? []) queue.push(target);
  }
  return input.nodes.filter((node) => affected.has(node.foldRef)).sort((left, right) => left.order - right.order).map((node) => node.foldRef);
}

function valueAt(value: Readonly<Record<string, unknown>> | undefined, path: readonly string[]): unknown {
  let current: unknown = value;
  for (const segment of path) {
    if (!current || typeof current !== "object" || Array.isArray(current) || !(segment in current)) return undefined;
    current = (current as Readonly<Record<string, unknown>>)[segment];
  }
  return current;
}

function validateGraph(input: FoldReprojectionInput): void {
  const refs = new Set<string>();
  for (const node of input.nodes) {
    if (!node.foldRef) throw new TypeError("fold-ref-required");
    if (refs.has(node.foldRef)) throw new TypeError(`fold-ref-duplicate:${node.foldRef}`);
    refs.add(node.foldRef);
  }
  for (const edge of input.dependencies) {
    if (!refs.has(edge.fromFoldRef) || !refs.has(edge.toFoldRef)) throw new TypeError(`dependency-fold-not-found:${edge.edgeRef}`);
  }
  const gateRefs = new Set<string>();
  for (const gate of input.gates) {
    if (gateRefs.has(gate.gateRef)) throw new TypeError(`gate-ref-duplicate:${gate.gateRef}`);
    gateRefs.add(gate.gateRef);
    if (!refs.has(gate.sourceFoldRef) || [...gate.activeFoldRefs, ...gate.fallbackFoldRefs].some((ref) => !refs.has(ref))) throw new TypeError(`gate-fold-not-found:${gate.gateRef}`);
    if (!gate.conditionScopeRef) throw new TypeError(`condition-scope-required:${gate.gateRef}`);
  }
  for (const node of input.nodes) if (node.branch && !gateRefs.has(node.branch.gateRef)) throw new TypeError(`branch-gate-not-found:${node.foldRef}`);
}
