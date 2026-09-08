import type { FoldBoundaryContinuation, FoldBoundaryMetrics, FoldPathStatistics, LastOrderViewModel } from "./index.js";

export interface ProceduralChildEdge { readonly fromNodeRef: string; readonly toNodeRef: string }
export interface RequiredTechnologyRoute { readonly routeRef: string; readonly entryNodeRef: string; readonly exitNodeRef: string }
export interface FoldBoundaryMetricsInput {
  /** presentation構造補助量。Dではない。 */
  readonly directChildNodeRefs: readonly string[];
  /** Fold内で明示されたcontext dimension ref。Dは一意ref数。 */
  readonly contextDimensionRefs: readonly string[];
  /** boundaryを跨ぐたび+1した各Fold-on-Fold pathの深度。 */
  readonly nestingPathDepths: readonly number[];
  /** API、adapter、tool等、元来のtechnology/tool chainを構成するnode。 */
  readonly technologyNodeRefs: readonly string[];
  readonly technologyChainEdges: readonly ProceduralChildEdge[];
  /** 実行に必要なentry→exit。未到達ならmLで補わずLast Orderへ送る。 */
  readonly requiredTechnologyRoutes: readonly RequiredTechnologyRoute[];
  /** 判断・解釈を含むcontext/meta chainを構成するnode。 */
  readonly metaContextNodeRefs: readonly string[];
  readonly metaContextChainEdges: readonly ProceduralChildEdge[];
  readonly nodePluginAvailable: boolean;
  readonly exitAdapterRef: string | null;
}

export interface FoldBoundaryContinuationInput {
  readonly mode: "spiritual-trust" | "imaginative-hypothesis";
  readonly domainRef: string;
  readonly claimantRef: string;
  readonly verificationStatus: "not-verified" | "verification-not-applicable" | "verification-prohibited";
  readonly verificationBoundaryRef?: string;
}

/** 宣言済みgraphだけからG/D/L/mL/Sを導出し、欠落edgeやcycleを成功扱いしない。 */
export function deriveFoldBoundaryMetrics(input: FoldBoundaryMetricsInput): FoldBoundaryMetrics {
  if (input.nestingPathDepths.some((depth) => !Number.isSafeInteger(depth) || depth < 0)) throw new TypeError("fold-nesting-depth-invalid");
  const directChildren = uniqueRefs(input.directChildNodeRefs, "fold-direct-child-ref-duplicate");
  const technologyNodes = uniqueRefs(input.technologyNodeRefs, "fold-technology-node-ref-duplicate");
  const metaContextNodes = uniqueRefs(input.metaContextNodeRefs, "fold-meta-context-node-ref-duplicate");
  const technologyLengths = chainLengths(technologyNodes, input.technologyChainEdges, "technology");
  const metaContextLengths = chainLengths(metaContextNodes, input.metaContextChainEdges, "meta-context");
  const brokenTechnologyRoutes = findBrokenTechnologyRoutes(technologyNodes, input.technologyChainEdges, input.requiredTechnologyRoutes);
  const technologyContinuity = input.requiredTechnologyRoutes.length === 0 ? "not-declared" as const : brokenTechnologyRoutes.length === 0 ? "connected" as const : "disconnected" as const;
  return Object.freeze({
    G: statistics(input.nestingPathDepths),
    D: new Set(input.contextDimensionRefs).size,
    L: Object.freeze({ ...statistics(technologyLengths), continuity: technologyContinuity, broken_route_refs: Object.freeze(brokenTechnologyRoutes) }),
    mL: statistics(metaContextLengths),
    direct_child_count: directChildren.size,
    S: Object.freeze({
      socket_present: input.nodePluginAvailable && input.exitAdapterRef !== null,
      adapter_ref: input.exitAdapterRef,
      on_missing: "last-order" as const,
    }),
  });
}

function uniqueRefs(refs: readonly string[], errorCode: string): ReadonlySet<string> {
  const unique = new Set(refs);
  if (unique.size !== refs.length) throw new TypeError(errorCode);
  return unique;
}

function chainLengths(nodes: ReadonlySet<string>, edges: readonly ProceduralChildEdge[], namespace: string): readonly number[] {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map([...nodes].map((ref) => [ref, 0]));
  const edgeKeys = new Set<string>();
  for (const edge of edges) {
    if (!nodes.has(edge.fromNodeRef) || !nodes.has(edge.toNodeRef)) throw new TypeError("fold-procedural-edge-node-not-found");
    const edgeKey = `${edge.fromNodeRef}\u0000${edge.toNodeRef}`;
    if (edgeKeys.has(edgeKey)) throw new TypeError(`fold-${namespace}-edge-duplicate`);
    edgeKeys.add(edgeKey);
    outgoing.set(edge.fromNodeRef, [...(outgoing.get(edge.fromNodeRef) ?? []), edge.toNodeRef]);
    incoming.set(edge.toNodeRef, (incoming.get(edge.toNodeRef) ?? 0) + 1);
  }
  const visiting = new Set<string>();
  const memo = new Map<string, readonly number[]>();
  const lengthsFrom = (ref: string): readonly number[] => {
    if (visiting.has(ref)) throw new TypeError(`fold-${namespace}-cycle`);
    const known = memo.get(ref);
    if (known !== undefined) return known;
    visiting.add(ref);
    const children = outgoing.get(ref) ?? [];
    const lengths = children.length === 0 ? [1] : children.flatMap((child) => lengthsFrom(child).map((length) => length + 1));
    visiting.delete(ref);
    memo.set(ref, lengths);
    return lengths;
  };
  // root以外からも走査して、rootを持たないcycleを必ず検出する。
  for (const ref of nodes) lengthsFrom(ref);
  const roots = [...nodes].filter((ref) => incoming.get(ref) === 0);
  return roots.flatMap(lengthsFrom);
}

/** 元のtool routeを成功偽装しないためのLast Order。別domainへの明示branchは否定しない。 */
export function foldBoundaryLastOrder(metrics: FoldBoundaryMetrics): LastOrderViewModel | undefined {
  if (!metrics.S.socket_present) return Object.freeze({
    code: "FOLD-SOCKET-MISSING",
    reason: "fold-boundary-socket-or-adapter-missing",
    requestedNext: "provide-node-plugin-and-exit-adapter",
    resumeWhen: "socket-present",
  });
  if (metrics.L.continuity === "disconnected") return Object.freeze({
    code: "FOLD-TOOL-CHAIN-DISCONNECTED",
    reason: `required-tool-route-disconnected:${metrics.L.broken_route_refs.join(",")}`,
    requestedNext: "restore-declared-tool-chain-route",
    resumeWhen: "all-required-tool-routes-connected",
  });
  return undefined;
}

/** 想像・霊的信頼を別domain branchとして宣言し、切れたLをconnectedへ偽装せず続行可能にする。 */
export function declareFoldBoundaryContinuation(metrics: FoldBoundaryMetrics, input: FoldBoundaryContinuationInput): FoldBoundaryContinuation {
  if (!input.domainRef.trim()) throw new TypeError("fold-continuation-domain-ref-required");
  if (!input.claimantRef.trim()) throw new TypeError("fold-continuation-claimant-ref-required");
  return Object.freeze({
    mode: input.mode,
    domain_ref: input.domainRef,
    claimant_ref: input.claimantRef,
    claim_status: input.mode === "spiritual-trust" ? "declared-belief" : "hypothesis",
    verification_status: input.verificationStatus,
    verification_boundary_ref: input.verificationBoundaryRef ?? null,
    source_tool_chain_continuity: metrics.L.continuity,
    relabels_tool_chain_as_connected: false as const,
  });
}

function findBrokenTechnologyRoutes(nodes: ReadonlySet<string>, edges: readonly ProceduralChildEdge[], routes: readonly RequiredTechnologyRoute[]): string[] {
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) outgoing.set(edge.fromNodeRef, [...(outgoing.get(edge.fromNodeRef) ?? []), edge.toNodeRef]);
  return routes.filter((route) => {
    if (!nodes.has(route.entryNodeRef) || !nodes.has(route.exitNodeRef)) return true;
    const pending = [route.entryNodeRef];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (current === route.exitNodeRef) return false;
      if (visited.has(current)) continue;
      visited.add(current);
      pending.push(...(outgoing.get(current) ?? []));
    }
    return true;
  }).map((route) => route.routeRef);
}

function statistics(values: readonly number[]): FoldPathStatistics {
  if (values.length === 0) return Object.freeze({ max: 0, median: 0, min: 0 });
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
  return Object.freeze({ max: sorted.at(-1)!, median, min: sorted[0]! });
}
