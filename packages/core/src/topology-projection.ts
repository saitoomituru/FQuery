import type { FoldChildPlanInput, FoldChildStatus } from "./parallel-fold.js";
import type { FamModuleReference, NormalizedFamTopology, NormalizedTopologyEdge } from "./topology.js";

export interface RunnerTopologyProjection {
  readonly sourceTopologyRef: string;
  readonly moduleRef: string;
  readonly revisionRef: string;
  readonly foldRef: string;
  readonly children: readonly FoldChildPlanInput[];
  readonly dependencyEdgeRefs: readonly string[];
  readonly executionAuthorized: false;
}

export interface PresentationTopologyNode {
  readonly nodeRef: string;
  readonly owningModuleRef: string;
  readonly owningRevisionRef: string;
  readonly owningFoldRef: string;
  readonly sourcePointer: string;
  readonly parentNodeRef: string | null;
}

export interface PresentationTopologyEdge {
  readonly edgeRef: string;
  readonly kind: NormalizedTopologyEdge["kind"];
  readonly relation: NormalizedTopologyEdge["relation"];
  readonly fromNodeRef: string;
  readonly toNodeRef: string;
  readonly owningFoldRef: string;
  readonly layerRefs: readonly string[];
}

export interface PresentationTopologyProjection {
  readonly sourceTopologyRef: string;
  readonly moduleRef: string;
  readonly revisionRef: string;
  readonly foldRef: string;
  readonly nodes: readonly PresentationTopologyNode[];
  readonly edges: readonly PresentationTopologyEdge[];
  readonly moduleReferences: readonly FamModuleReference[];
  readonly canonicalSemanticState: false;
}

/** mL runtime edgeだけをRunner dependencyへ投影し、array/L順を実行順へ混ぜない。 */
export function projectTopologyForRunner(
  topology: NormalizedFamTopology,
  statusByNodeRef: Readonly<Record<string, FoldChildStatus>> = {},
): RunnerTopologyProjection {
  const childNodeRefs = new Set(topology.nodes.filter((node) => node.nodeRef !== topology.rootNodeRef).map((node) => node.nodeRef));
  const runtimeEdges = topology.edges.filter((edge) => edge.kind === "runtime"
    && childNodeRefs.has(edge.fromNodeRef)
    && childNodeRefs.has(edge.toNodeRef));
  const dependencies = new Map<string, string[]>();
  for (const nodeRef of childNodeRefs) dependencies.set(nodeRef, []);
  for (const edge of runtimeEdges) dependencies.get(edge.toNodeRef)?.push(edge.fromNodeRef);

  return Object.freeze({
    sourceTopologyRef: topologyRef(topology),
    moduleRef: topology.moduleRef,
    revisionRef: topology.revisionRef,
    foldRef: topology.foldRef,
    children: Object.freeze(topology.nodes
      .filter((node) => childNodeRefs.has(node.nodeRef))
      .map((node): FoldChildPlanInput => Object.freeze({
        childRef: node.nodeRef,
        dependsOn: Object.freeze([...new Set(dependencies.get(node.nodeRef) ?? [])]),
        status: statusByNodeRef[node.nodeRef] ?? "ready",
      }))),
    dependencyEdgeRefs: Object.freeze(runtimeEdges.map((edge) => edge.edgeRef)),
    executionAuthorized: false,
  });
}

/** renderer固有edgeを作らず、同じTopology IRをlayout非依存の表示入力へ投影する。 */
export function projectTopologyForPresentation(topology: NormalizedFamTopology): PresentationTopologyProjection {
  return Object.freeze({
    sourceTopologyRef: topologyRef(topology),
    moduleRef: topology.moduleRef,
    revisionRef: topology.revisionRef,
    foldRef: topology.foldRef,
    nodes: Object.freeze(topology.nodes.map((node): PresentationTopologyNode => Object.freeze({
      nodeRef: node.nodeRef,
      owningModuleRef: node.owningModuleRef,
      owningRevisionRef: node.owningRevisionRef,
      owningFoldRef: node.owningFoldRef,
      sourcePointer: node.sourcePointer,
      parentNodeRef: node.parentNodeRef,
    }))),
    edges: Object.freeze(topology.edges.map((edge): PresentationTopologyEdge => Object.freeze({
      edgeRef: edge.edgeRef,
      kind: edge.kind,
      relation: edge.relation,
      fromNodeRef: edge.fromNodeRef,
      toNodeRef: edge.toNodeRef,
      owningFoldRef: edge.owningFoldRef,
      layerRefs: edge.layerRefs,
    }))),
    moduleReferences: topology.moduleReferences,
    canonicalSemanticState: false,
  });
}

function topologyRef(topology: NormalizedFamTopology): string {
  return `${topology.moduleRef}@${topology.revisionRef}#${topology.foldRef}`;
}
