export const NORMALIZED_TOPOLOGY_SCHEMA_VERSION = "fquery.topology/0.1.0-draft" as const;

export type FamSelectorBase = "self" | "this";
export type FamTraversal = "parent" | "children" | "siblings" | "prev" | "next" | "before" | "after";
export type TopologyEdgeKind = "containment" | "structural" | "runtime";

export interface FamTopologyModuleInput {
  readonly moduleRef: string;
  readonly revisionRef: string;
  readonly foldRef: string;
  readonly value: unknown;
}

export interface ParsedFamSelector {
  readonly raw: string;
  readonly base: FamSelectorBase;
  readonly traversal?: FamTraversal;
  readonly qualifiers: readonly string[];
}

export interface TopologySelectorDeclaration {
  readonly nodeRef: string;
  readonly sourcePointer: string;
  readonly selector: ParsedFamSelector;
}

export interface NormalizedTopologyNode {
  readonly nodeRef: string;
  readonly owningModuleRef: string;
  readonly owningRevisionRef: string;
  readonly owningFoldRef: string;
  readonly sourcePointer: string;
  readonly parentNodeRef: string | null;
  readonly childNodeRefs: readonly string[];
  readonly siblingNodeRefs: readonly string[];
  readonly containerKind: "module-root" | "array-item" | "object-property" | "single-child";
  readonly addressKey?: string;
  readonly arrayIndex?: number;
  readonly parallelCollectionRef?: string;
}

export interface NormalizedTopologyEdge {
  readonly edgeRef: string;
  readonly kind: TopologyEdgeKind;
  readonly relation: "parent-child" | "prev-next" | "before-after";
  readonly fromNodeRef: string;
  readonly toNodeRef: string;
  readonly owningFoldRef: string;
  readonly layerRefs: readonly string[];
  readonly sourceSelectors: readonly string[];
}

export interface FamModuleReference {
  readonly sourceModuleRef: string;
  readonly sourceRevisionRef: string;
  readonly sourceFoldRef: string;
  readonly sourceNodeRef: string;
  readonly sourcePointer: string;
  readonly targetFamRef: string;
  readonly targetRevisionRef?: string;
  readonly transitionRef?: string;
}

export interface TopologyIssue {
  readonly code:
    | "fam-module-record-required"
    | "fam-node-root-required"
    | "duplicate-node-ref"
    | "unresolved-selector"
    | "invalid-selector"
    | "layer-registry-fold-mismatch"
    | "unresolved-layer-ref";
  readonly sourcePointer: string;
  readonly detail: string;
}

export interface NormalizedFamTopology {
  readonly schemaVersion: typeof NORMALIZED_TOPOLOGY_SCHEMA_VERSION;
  readonly moduleRef: string;
  readonly revisionRef: string;
  readonly foldRef: string;
  readonly rootNodeRef: string;
  readonly nodes: readonly NormalizedTopologyNode[];
  readonly edges: readonly NormalizedTopologyEdge[];
  readonly selectors: readonly TopologySelectorDeclaration[];
  readonly moduleReferences: readonly FamModuleReference[];
  readonly issues: readonly TopologyIssue[];
}

export type SelectorResolution =
  | {
    readonly status: "resolved";
    readonly targetKind: "module";
    readonly moduleRef: string;
    readonly revisionRef: string;
    readonly foldRef: string;
  }
  | {
    readonly status: "resolved";
    readonly targetKind: "node" | "nodes";
    readonly nodeRefs: readonly string[];
  }
  | {
    readonly status: "unresolved" | "invalid";
    readonly reason: string;
    readonly nodeRefs: readonly string[];
  };

export interface LayerReferenceRegistry {
  readonly foldRef: string;
  readonly layerRefs: readonly string[];
}

export interface LayerReferenceValidation {
  readonly pointerStatus: "valid" | "invalid";
  readonly classificationStatus: "not-evaluated";
  readonly issues: readonly TopologyIssue[];
}

interface MutableTopologyNode {
  readonly nodeRef: string;
  readonly owningModuleRef: string;
  readonly owningRevisionRef: string;
  readonly owningFoldRef: string;
  readonly sourcePointer: string;
  readonly parentNodeRef: string | null;
  readonly childNodeRefs: string[];
  readonly containerKind: NormalizedTopologyNode["containerKind"];
  readonly addressKey?: string;
  readonly arrayIndex?: number;
  readonly parallelCollectionRef?: string;
  readonly value: Record<string, unknown>;
}

interface ChildCandidate {
  readonly value: Record<string, unknown>;
  readonly sourcePointer: string;
  readonly containerKind: MutableTopologyNode["containerKind"];
  readonly addressKey?: string;
  readonly arrayIndex?: number;
  readonly parallelCollectionRef?: string;
}

/**
 * selector syntaxだけを読み、layer名の意味やtargetの存在は裁定しない。
 */
export function parseFamSelector(value: string): ParsedFamSelector | undefined {
  const parts = value.split(".");
  const base = parts[0];
  if (base !== "self" && base !== "this") return undefined;
  if (parts.some((part) => part.length === 0)) return undefined;
  if (base === "self") {
    if (parts.length !== 1) return undefined;
    return Object.freeze({ raw: value, base, qualifiers: Object.freeze([]) });
  }
  if (parts.length === 1) return Object.freeze({ raw: value, base, qualifiers: Object.freeze([]) });
  const traversal = parts[1];
  if (!isTraversal(traversal)) return undefined;
  return Object.freeze({ raw: value, base, traversal, qualifiers: Object.freeze(parts.slice(2)) });
}

/**
 * 一つのFAM moduleをcurrent Fold内のTopology IRへ正規化する。
 * 別FAMはmoduleReferencesへ残し、payloadをinline展開しない。
 */
export function normalizeFamTopology(input: FamTopologyModuleInput): NormalizedFamTopology {
  assertNonEmpty(input.moduleRef, "moduleRef");
  assertNonEmpty(input.revisionRef, "revisionRef");
  assertNonEmpty(input.foldRef, "foldRef");

  const issues: TopologyIssue[] = [];
  if (!isRecord(input.value)) {
    issues.push(freezeIssue("fam-module-record-required", "$", "FAM moduleはobjectでなければなりません"));
    return freezeTopology(input, `${input.moduleRef}#`, [], [], [], [], issues);
  }
  if (!isFamNodeCandidate(input.value)) {
    issues.push(freezeIssue("fam-node-root-required", "$", "module rootにFAMの4軸がありません"));
    return freezeTopology(input, `${input.moduleRef}#`, [], [], [], [], issues);
  }

  const mutableNodes: MutableTopologyNode[] = [];
  const nodeRefs = new Set<string>();
  const declarations: TopologySelectorDeclaration[] = [];
  const moduleReferences: FamModuleReference[] = [];

  const visit = (candidate: ChildCandidate, parentNodeRef: string | null): string => {
    const explicitRef = readExplicitNodeRef(candidate.value);
    const pointerRef = `${input.moduleRef}#${candidate.sourcePointer === "$" ? "" : candidate.sourcePointer.slice(1)}`;
    let nodeRef = explicitRef ?? pointerRef;
    if (nodeRefs.has(nodeRef)) {
      issues.push(freezeIssue("duplicate-node-ref", candidate.sourcePointer, nodeRef));
      nodeRef = pointerRef;
    }
    nodeRefs.add(nodeRef);
    const node: MutableTopologyNode = {
      nodeRef,
      owningModuleRef: input.moduleRef,
      owningRevisionRef: input.revisionRef,
      owningFoldRef: input.foldRef,
      sourcePointer: candidate.sourcePointer,
      parentNodeRef,
      childNodeRefs: [],
      containerKind: candidate.containerKind,
      value: candidate.value,
      ...(candidate.addressKey === undefined ? {} : { addressKey: candidate.addressKey }),
      ...(candidate.arrayIndex === undefined ? {} : { arrayIndex: candidate.arrayIndex }),
      ...(candidate.parallelCollectionRef === undefined ? {} : { parallelCollectionRef: candidate.parallelCollectionRef }),
    };
    mutableNodes.push(node);

    collectSelectors(candidate.value, candidate.sourcePointer, nodeRef, declarations, issues);
    collectModuleReferences(candidate.value, candidate.sourcePointer, nodeRef, input, moduleReferences);

    for (const child of directChildren(candidate.value, candidate.sourcePointer, nodeRef)) {
      node.childNodeRefs.push(visit(child, nodeRef));
    }
    return nodeRef;
  };

  const rootNodeRef = visit({ value: input.value, sourcePointer: "$", containerKind: "module-root" }, null);
  const edges: NormalizedTopologyEdge[] = [];
  const edgeByKey = new Map<string, NormalizedTopologyEdge>();

  for (const node of mutableNodes) {
    for (const childRef of node.childNodeRefs) {
      addEdge(edgeByKey, edges, {
        kind: "containment",
        relation: "parent-child",
        fromNodeRef: node.nodeRef,
        toNodeRef: childRef,
        owningFoldRef: input.foldRef,
        layerRefs: [],
        sourceSelector: undefined,
      });
    }
  }

  const byRef = new Map(mutableNodes.map((node) => [node.nodeRef, node]));
  for (const declaration of declarations) {
    const traversal = declaration.selector.traversal;
    if (!traversal || !isDirectionalTraversal(traversal)) continue;
    const source = byRef.get(declaration.nodeRef);
    if (!source) continue;
    const target = resolveDeclaredDirectionalTarget(source, traversal, declaration.selector.qualifiers, byRef);
    if (!target) {
      issues.push(freezeIssue("unresolved-selector", declaration.sourcePointer, declaration.selector.raw));
      continue;
    }
    const exactAddress = declaration.selector.qualifiers.length > 0
      && target.addressKey === declaration.selector.qualifiers.join(".");
    const layerRefs = exactAddress ? [] : declaration.selector.qualifiers;
    const forward = traversal === "next" || traversal === "after";
    addEdge(edgeByKey, edges, {
      kind: traversal === "prev" || traversal === "next" ? "structural" : "runtime",
      relation: traversal === "prev" || traversal === "next" ? "prev-next" : "before-after",
      fromNodeRef: forward ? source.nodeRef : target.nodeRef,
      toNodeRef: forward ? target.nodeRef : source.nodeRef,
      owningFoldRef: input.foldRef,
      layerRefs,
      sourceSelector: declaration.selector.raw,
    });
  }

  const nodes = mutableNodes.map((node): NormalizedTopologyNode => {
    const siblingNodeRefs = node.parentNodeRef === null
      ? []
      : byRef.get(node.parentNodeRef)?.childNodeRefs.filter((ref) => ref !== node.nodeRef) ?? [];
    return Object.freeze({
      nodeRef: node.nodeRef,
      owningModuleRef: node.owningModuleRef,
      owningRevisionRef: node.owningRevisionRef,
      owningFoldRef: node.owningFoldRef,
      sourcePointer: node.sourcePointer,
      parentNodeRef: node.parentNodeRef,
      childNodeRefs: Object.freeze([...node.childNodeRefs]),
      siblingNodeRefs: Object.freeze([...siblingNodeRefs]),
      containerKind: node.containerKind,
      ...(node.addressKey === undefined ? {} : { addressKey: node.addressKey }),
      ...(node.arrayIndex === undefined ? {} : { arrayIndex: node.arrayIndex }),
      ...(node.parallelCollectionRef === undefined ? {} : { parallelCollectionRef: node.parallelCollectionRef }),
    });
  });

  return freezeTopology(input, rootNodeRef, nodes, edges, declarations, moduleReferences, issues);
}

/** current topology以外を探索せずselectorを解決する。 */
export function resolveTopologySelector(
  topology: NormalizedFamTopology,
  currentNodeRef: string,
  selectorValue: string,
): SelectorResolution {
  const selector = parseFamSelector(selectorValue);
  if (!selector) return Object.freeze({ status: "invalid", reason: "invalid-selector", nodeRefs: Object.freeze([]) });
  if (selector.base === "self") {
    return Object.freeze({
      status: "resolved",
      targetKind: "module",
      moduleRef: topology.moduleRef,
      revisionRef: topology.revisionRef,
      foldRef: topology.foldRef,
    });
  }
  const current = topology.nodes.find((node) => node.nodeRef === currentNodeRef);
  if (!current) return Object.freeze({ status: "unresolved", reason: "current-node-not-found", nodeRefs: Object.freeze([]) });
  if (!selector.traversal) {
    return Object.freeze({ status: "resolved", targetKind: "node", nodeRefs: Object.freeze([current.nodeRef]) });
  }

  let candidates: readonly string[];
  switch (selector.traversal) {
    case "parent": candidates = current.parentNodeRef ? [current.parentNodeRef] : []; break;
    case "children": candidates = current.childNodeRefs; break;
    case "siblings": candidates = current.siblingNodeRefs; break;
    case "prev": candidates = incoming(topology, current.nodeRef, "structural"); break;
    case "next": candidates = outgoing(topology, current.nodeRef, "structural"); break;
    case "before": candidates = incoming(topology, current.nodeRef, "runtime"); break;
    case "after": candidates = outgoing(topology, current.nodeRef, "runtime"); break;
  }
  if (selector.qualifiers.length > 0) {
    const qualifier = selector.qualifiers.join(".");
    const addressed = candidates.filter((ref) => topology.nodes.find((node) => node.nodeRef === ref)?.addressKey === qualifier);
    if (addressed.length > 0) candidates = addressed;
    else candidates = candidates.filter((ref) => edgeMatchesQualifiedTraversal(topology, current.nodeRef, ref, selector.traversal!, qualifier));
  }
  if (candidates.length === 0) return Object.freeze({ status: "unresolved", reason: "selector-target-not-found-in-current-fold", nodeRefs: Object.freeze([]) });
  return Object.freeze({
    status: "resolved",
    targetKind: candidates.length === 1 ? "node" : "nodes",
    nodeRefs: Object.freeze([...candidates]),
  });
}

/** layerの意味分類は行わず、current Fold registry上のpointer存在だけを検証する。 */
export function validateTopologyLayerReferences(
  topology: NormalizedFamTopology,
  registry: LayerReferenceRegistry,
): LayerReferenceValidation {
  const issues: TopologyIssue[] = [];
  if (registry.foldRef !== topology.foldRef) {
    issues.push(freezeIssue("layer-registry-fold-mismatch", "$", `${registry.foldRef} != ${topology.foldRef}`));
  }
  const known = new Set(registry.layerRefs);
  for (const edge of topology.edges) {
    for (const layerRef of edge.layerRefs) {
      if (!known.has(layerRef)) issues.push(freezeIssue("unresolved-layer-ref", edge.edgeRef, layerRef));
    }
  }
  return Object.freeze({
    pointerStatus: issues.length === 0 ? "valid" : "invalid",
    classificationStatus: "not-evaluated",
    issues: Object.freeze(issues),
  });
}

function directChildren(value: Record<string, unknown>, nodePointer: string, nodeRef: string): ChildCandidate[] {
  const gradient = value["∇φ"];
  const gradientPointer = appendPointer(nodePointer, "∇φ");
  if (Array.isArray(gradient)) {
    const parallelCollectionRef = `${nodeRef}/parallel/∇φ`;
    return gradient.flatMap((entry, index): ChildCandidate[] => isRecord(entry) && isFamNodeCandidate(entry) ? [{
      value: entry,
      sourcePointer: appendPointer(gradientPointer, String(index)),
      containerKind: "array-item",
      arrayIndex: index,
      parallelCollectionRef,
    }] : []);
  }
  if (!isRecord(gradient)) return [];
  if (isFamNodeCandidate(gradient)) {
    return [{ value: gradient, sourcePointer: gradientPointer, containerKind: "single-child" }];
  }
  return Object.entries(gradient).flatMap(([key, entry]): ChildCandidate[] => isRecord(entry) && isFamNodeCandidate(entry) ? [{
    value: entry,
    sourcePointer: appendPointer(gradientPointer, key),
    containerKind: "object-property",
    addressKey: key,
  }] : []);
}

function collectSelectors(
  value: unknown,
  pointer: string,
  nodeRef: string,
  declarations: TopologySelectorDeclaration[],
  issues: TopologyIssue[],
  root = true,
): void {
  if (typeof value === "string") {
    if (value === "self" || value === "this" || value.startsWith("self.") || value.startsWith("this.")) {
      const selector = parseFamSelector(value);
      if (selector) declarations.push(Object.freeze({ nodeRef, sourcePointer: pointer, selector }));
      else issues.push(freezeIssue("invalid-selector", pointer, value));
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      if (isRecord(entry) && isFamNodeCandidate(entry)) return;
      collectSelectors(entry, appendPointer(pointer, String(index)), nodeRef, declarations, issues, false);
    });
    return;
  }
  if (!isRecord(value) || (!root && isFamNodeCandidate(value))) return;
  for (const [key, entry] of Object.entries(value)) collectSelectors(entry, appendPointer(pointer, key), nodeRef, declarations, issues, false);
}

function edgeMatchesQualifiedTraversal(
  topology: NormalizedFamTopology,
  currentNodeRef: string,
  candidateNodeRef: string,
  traversal: FamTraversal,
  qualifier: string,
): boolean {
  const kind = traversal === "prev" || traversal === "next" ? "structural" : "runtime";
  const forward = traversal === "next" || traversal === "after";
  return topology.edges.some((edge) => edge.kind === kind
    && edge.layerRefs.includes(qualifier)
    && (forward
      ? edge.fromNodeRef === currentNodeRef && edge.toNodeRef === candidateNodeRef
      : edge.fromNodeRef === candidateNodeRef && edge.toNodeRef === currentNodeRef));
}

function collectModuleReferences(
  value: unknown,
  pointer: string,
  nodeRef: string,
  module: FamTopologyModuleInput,
  references: FamModuleReference[],
  root = true,
): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      if (isRecord(entry) && isFamNodeCandidate(entry)) return;
      collectModuleReferences(entry, appendPointer(pointer, String(index)), nodeRef, module, references, false);
    });
    return;
  }
  if (!isRecord(value) || (!root && isFamNodeCandidate(value))) return;
  if (typeof value.fam_ref === "string" && value.fam_ref.length > 0) {
    references.push(Object.freeze({
      sourceModuleRef: module.moduleRef,
      sourceRevisionRef: module.revisionRef,
      sourceFoldRef: module.foldRef,
      sourceNodeRef: nodeRef,
      sourcePointer: pointer,
      targetFamRef: value.fam_ref,
      ...(typeof value.revision_ref === "string" ? { targetRevisionRef: value.revision_ref } : {}),
      ...(typeof value.transition_ref === "string" ? { transitionRef: value.transition_ref } : {}),
    }));
  }
  for (const [key, entry] of Object.entries(value)) collectModuleReferences(entry, appendPointer(pointer, key), nodeRef, module, references, false);
}

function resolveDeclaredDirectionalTarget(
  source: MutableTopologyNode,
  traversal: Extract<FamTraversal, "prev" | "next" | "before" | "after">,
  qualifiers: readonly string[],
  byRef: ReadonlyMap<string, MutableTopologyNode>,
): MutableTopologyNode | undefined {
  if (!source.parentNodeRef) return undefined;
  const siblings = byRef.get(source.parentNodeRef)?.childNodeRefs.map((ref) => byRef.get(ref)).filter(isDefined) ?? [];
  if (qualifiers.length > 0) {
    const address = qualifiers.join(".");
    const exact = siblings.find((node) => node.addressKey === address);
    if (exact) return exact;
  }
  const index = siblings.findIndex((node) => node.nodeRef === source.nodeRef);
  if (index < 0) return undefined;
  const offset = traversal === "next" || traversal === "after" ? 1 : -1;
  return siblings[index + offset];
}

function addEdge(
  byKey: Map<string, NormalizedTopologyEdge>,
  edges: NormalizedTopologyEdge[],
  input: {
    readonly kind: TopologyEdgeKind;
    readonly relation: NormalizedTopologyEdge["relation"];
    readonly fromNodeRef: string;
    readonly toNodeRef: string;
    readonly owningFoldRef: string;
    readonly layerRefs: readonly string[];
    readonly sourceSelector: string | undefined;
  },
): void {
  const key = `${input.kind}\u0000${input.fromNodeRef}\u0000${input.toNodeRef}`;
  const previous = byKey.get(key);
  if (previous) {
    const replacement = freezeEdge(input, [...new Set([...previous.layerRefs, ...input.layerRefs])], [
      ...previous.sourceSelectors,
      ...(input.sourceSelector ? [input.sourceSelector] : []),
    ]);
    byKey.set(key, replacement);
    edges[edges.indexOf(previous)] = replacement;
    return;
  }
  const edge = freezeEdge(input, input.layerRefs, input.sourceSelector ? [input.sourceSelector] : []);
  byKey.set(key, edge);
  edges.push(edge);
}

function freezeEdge(
  input: {
    readonly kind: TopologyEdgeKind;
    readonly relation: NormalizedTopologyEdge["relation"];
    readonly fromNodeRef: string;
    readonly toNodeRef: string;
    readonly owningFoldRef: string;
  },
  layerRefs: readonly string[],
  sourceSelectors: readonly string[],
): NormalizedTopologyEdge {
  return Object.freeze({
    edgeRef: `edge://${encodeURIComponent(input.kind)}/${encodeURIComponent(input.fromNodeRef)}/${encodeURIComponent(input.toNodeRef)}`,
    kind: input.kind,
    relation: input.relation,
    fromNodeRef: input.fromNodeRef,
    toNodeRef: input.toNodeRef,
    owningFoldRef: input.owningFoldRef,
    layerRefs: Object.freeze([...new Set(layerRefs)]),
    sourceSelectors: Object.freeze([...new Set(sourceSelectors)]),
  });
}

function freezeTopology(
  input: FamTopologyModuleInput,
  rootNodeRef: string,
  nodes: readonly NormalizedTopologyNode[],
  edges: readonly NormalizedTopologyEdge[],
  selectors: readonly TopologySelectorDeclaration[],
  moduleReferences: readonly FamModuleReference[],
  issues: readonly TopologyIssue[],
): NormalizedFamTopology {
  return Object.freeze({
    schemaVersion: NORMALIZED_TOPOLOGY_SCHEMA_VERSION,
    moduleRef: input.moduleRef,
    revisionRef: input.revisionRef,
    foldRef: input.foldRef,
    rootNodeRef,
    nodes: Object.freeze([...nodes]),
    edges: Object.freeze([...edges]),
    selectors: Object.freeze([...selectors]),
    moduleReferences: Object.freeze([...moduleReferences]),
    issues: Object.freeze([...issues]),
  });
}

function incoming(topology: NormalizedFamTopology, nodeRef: string, kind: TopologyEdgeKind): readonly string[] {
  return topology.edges.filter((edge) => edge.kind === kind && edge.toNodeRef === nodeRef).map((edge) => edge.fromNodeRef);
}

function outgoing(topology: NormalizedFamTopology, nodeRef: string, kind: TopologyEdgeKind): readonly string[] {
  return topology.edges.filter((edge) => edge.kind === kind && edge.fromNodeRef === nodeRef).map((edge) => edge.toNodeRef);
}

function readExplicitNodeRef(value: Record<string, unknown>): string | undefined {
  const q = isRecord(value.Q) ? value.Q : undefined;
  for (const candidate of [q?.node_ref, q?.unit_ref]) {
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
  }
  return undefined;
}

function isFamNodeCandidate(value: Record<string, unknown>): boolean {
  return ("ψ" in value || "Ψ" in value) && "∇φ" in value && "λ" in value && "Q" in value;
}

function isTraversal(value: string | undefined): value is FamTraversal {
  return value === "parent" || value === "children" || value === "siblings"
    || value === "prev" || value === "next" || value === "before" || value === "after";
}

function isDirectionalTraversal(value: FamTraversal): value is Extract<FamTraversal, "prev" | "next" | "before" | "after"> {
  return value === "prev" || value === "next" || value === "before" || value === "after";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function appendPointer(pointer: string, segment: string): string {
  const escaped = segment.replaceAll("~", "~0").replaceAll("/", "~1");
  return pointer === "$" ? `$/${escaped}` : `${pointer}/${escaped}`;
}

function freezeIssue(code: TopologyIssue["code"], sourcePointer: string, detail: string): TopologyIssue {
  return Object.freeze({ code, sourcePointer, detail });
}

function assertNonEmpty(value: string, name: string): void {
  if (value.length === 0) throw new TypeError(`${name}は空にできません`);
}
