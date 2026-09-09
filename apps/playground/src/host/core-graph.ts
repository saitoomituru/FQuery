import { corePortId, deriveFoldBoundaryMetrics, statusTone, type NodeViewModel, type PresentationSession, type PresentationSessionState } from "@fquery/ui-core";
import { projectDecompositionUnits, type AccessMapProfile, type FamJsonRecord } from "@fquery/fam-core";
import type { FoldReprojectionResult } from "@fquery/core";

export interface CoreNodeIds {
  readonly psi?: string | undefined;
  readonly famvim?: string | undefined;
  readonly lambda?: string | undefined;
  readonly gradients?: readonly string[] | undefined;
}

export function layoutSlotRef(nodeId: string): string {
  return `layout://playground/${nodeId}`;
}

/** Core 3 nodeをpluginなしで構築する。接続の可否はportへ委譲する。 */
export async function buildCoreGraph(session: PresentationSession): Promise<CoreNodeIds> {
  const psi = await addCoreNode(session, "core.psi.nl-input", 1);
  const famvim = await addCoreNode(session, "core.gradient.famvim", 2);
  const lambda = await addCoreNode(session, "core.lambda.nl-output", 3);
  if (psi && famvim) await session.dispatch({ type: "connection.add.requested", requestId: "playground:connect:psi-famvim", fromPortId: corePortId(psi, "observation"), toPortId: corePortId(famvim, "psi") });
  if (famvim && lambda) await session.dispatch({ type: "connection.add.requested", requestId: "playground:connect:famvim-lambda", fromPortId: corePortId(famvim, "fam"), toPortId: corePortId(lambda, "fam") });
  const positions = [psi, famvim, lambda].map((nodeId, index) => ({ nodeId, x: 40 + index * 380, y: 80 }));
  for (const position of positions) {
    if (!position.nodeId) continue;
    await session.dispatch({ type: "node.move.requested", requestId: `playground:layout:${position.nodeId}`, nodeId: position.nodeId, layoutSlotRef: layoutSlotRef(position.nodeId), x: position.x, y: position.y });
  }
  return { psi, famvim, lambda };
}

export async function addCoreNode(session: PresentationSession, capability: string, sequence: number): Promise<string | undefined> {
  const state = await session.dispatch({ type: "node.add.requested", requestId: `playground:add:${sequence}`, capability });
  const decision = state.decisions.at(-1);
  return decision?.kind === "node.add" && decision.status === "accepted" ? decision.node?.nodeId : undefined;
}

let graphSequence = 10;

/** canonical decomposition FAMを、1 Ψ → N ∇φ → 1 λの独立node graphへ投影する。 */
export async function projectDecompositionGraph(
  session: PresentationSession,
  current: CoreNodeIds,
  fam: FamJsonRecord,
  accessMap: AccessMapProfile,
): Promise<CoreNodeIds> {
  const removable = [...(current.gradients ?? []), ...(current.famvim ? [current.famvim] : [])];
  for (const nodeId of new Set(removable)) {
    graphSequence += 1;
    await session.dispatch({ type: "node.remove.requested", requestId: `playground:remove-gradient:${graphSequence}`, nodeId });
  }
  const units = projectDecompositionUnits(fam, accessMap);
  const gradients: string[] = [];
  for (const unit of units) {
    graphSequence += 1;
    const nodeId = await addCoreNode(session, "core.gradient.famvim", graphSequence);
    if (!nodeId) continue;
    gradients.push(nodeId);
    const node = session.state.nodes.find((candidate) => candidate.nodeId === nodeId)!;
    session.applyEngineEvent({
      type: "fam.node.changed",
      node: {
        ...node,
        label: `∇φ-${unit.order + 1}`,
        foldRef: unit.unitRef,
        parentFoldRef: unit.parentFamRef,
        revisionRef: unit.unitRevisionRef,
        depth: 0,
        collapsed: false,
        projectionFreshness: "fresh",
        value: { unit: unit.value, classification: unit.classification, sourcePointer: unit.sourcePointer },
        badges: [{ axis: "classification", value: unit.classification.dimensionRef ?? "unmapped", tone: unit.classification.status === "mapped" ? "active" : "unknown" }],
        evidenceRefs: [`${accessMap.famId}@${accessMap.revisionId}`],
      },
    });
    if (current.psi) await session.dispatch({ type: "connection.add.requested", requestId: `playground:connect-psi-gradient:${graphSequence}`, fromPortId: corePortId(current.psi, "observation"), toPortId: corePortId(nodeId, "psi") });
    if (current.lambda) await session.dispatch({ type: "connection.add.requested", requestId: `playground:connect-gradient-lambda:${graphSequence}`, fromPortId: corePortId(nodeId, "fam"), toPortId: corePortId(current.lambda, "fam") });
  }
  await layoutDecomposition(session, current.psi, gradients, current.lambda);
  return Object.freeze({ psi: current.psi, lambda: current.lambda, gradients: Object.freeze(gradients) });
}

/** 「なんで？-DeFold-」の子decompositionを、親unit identityを保った階層nodeとして追加する。 */
export interface RecursiveFoldProjection {
  readonly boundaryNodeId: string;
  readonly childNodeIds: readonly string[];
  readonly replacedNode: NodeViewModel;
}

/** Fold境界配下を子から除去し、同一IDで置換した元unitを復元する。 */
export async function removeRecursiveFoldProjection(session: PresentationSession, projection: RecursiveFoldProjection): Promise<void> {
  for (const nodeId of projection.childNodeIds) {
    if (!session.state.nodes.some((node) => node.nodeId === nodeId)) continue;
    graphSequence += 1;
    await session.dispatch({ type: "node.remove.requested", requestId: `playground:remove-recursive-fold:${graphSequence}`, nodeId });
  }
  session.applyEngineEvent({ type: "fam.node.changed", node: projection.replacedNode });
  if (projection.replacedNode.presentation) {
    session.applyEngineEvent({ type: "presentation.changed", targetRef: projection.boundaryNodeId, projection: projection.replacedNode.presentation });
  }
}

/** 親unitへRunnerの状態を投影し、「なんで？-DeFold-」のbusy表示をsession stateと同期する。 */
export function setRecursiveFoldStatus(session: PresentationSession, nodeId: string, status: "running" | "complete" | "failed" | "cancelled"): void {
  const node = session.state.nodes.find((candidate) => candidate.nodeId === nodeId);
  if (!node) return;
  session.applyEngineEvent({
    type: "fam.node.changed",
    node: {
      ...node,
      badges: [...node.badges.filter((badge) => badge.axis !== "recursive"), { axis: "recursive", value: status, tone: statusTone(status) }],
      canCancel: status === "running",
    },
  });
}

/** unit局所差替えの要求・採否をcanvas上へ返し、無反応に見える状態を作らない。 */
export function setUnitEditStatus(session: PresentationSession, nodeId: string, status: "requested" | "accepted" | "rejected"): void {
  const node = session.state.nodes.find((candidate) => candidate.nodeId === nodeId);
  if (!node) return;
  session.applyEngineEvent({
    type: "fam.node.changed",
    node: {
      ...node,
      badges: [...node.badges.filter((badge) => badge.axis !== "edit"), { axis: "edit", value: status, tone: statusTone(status) }],
    },
  });
}

/** Foldの意味構造を残したまま、canvas投影だけを縮約または再展開する。 */
export function setFoldBoundaryCollapsed(session: PresentationSession, nodeId: string, collapsed: boolean): boolean {
  const node = session.state.nodes.find((candidate) => candidate.nodeId === nodeId);
  if (!node?.foldBoundary) return false;
  session.applyEngineEvent({ type: "fam.node.changed", node: { ...node, collapsed } });
  return true;
}

export async function projectRecursiveDecompositionGraph(
  session: PresentationSession,
  parentNodeId: string,
  fam: FamJsonRecord,
  accessMap: AccessMapProfile,
  generation = 1,
): Promise<RecursiveFoldProjection> {
  const parent = session.state.nodes.find((node) => node.nodeId === parentNodeId);
  if (!parent?.foldRef) throw new TypeError("recursive-parent-fold-ref-required");
  graphSequence += 1;
  // Foldは親unitの隣へ増設せず、同じstable node IDを保ったまま表示・実行境界へ昇格する。
  // これにより既存の外Ψ→親→外λ connectionは切断せず、そのまま境界gateへ接続される。
  const boundaryNodeId = parentNodeId;
  const boundaryRef = `fold-boundary://${parent.foldRef}/generation/${generation}`;
  const boundaryDepth = parent.depth ?? 0;
  const gravityDepth = foldBoundaryAncestorCount(session, parentNodeId) + 1;
  const boundaryWidth = 760;
  const units = projectDecompositionUnits(fam, accessMap);
  const boundaryHeight = Math.max(460, units.length * 340 + 120);
  const boundaryPresentation = { targetRef: boundaryNodeId, mode: "native" as const, rendererId: "react-flow", presentation: { schemaVersion: "fquery.presentation-fam/0.1.0-draft" as const, presentationId: "presentation://fquery/core/fold-boundary", targetRef: boundaryNodeId, surfaces: ["node-editor" as const, "inspector" as const], visualRole: "fold-boundary", interfaceRoles: ["atomic-resolution", "single-processing-unit"], visibility: "visible" as const, rendererHint: "fquery-fold-boundary", category: "Core", aliases: ["Fold", "D/G/L/S"], layoutSlotRef: layoutSlotRef(boundaryNodeId) } };
  const boundaryNode: NodeViewModel = {
    nodeId: boundaryNodeId,
    label: `Fold · ${parent.label}`,
    badges: [{ axis: "fold", value: "running", tone: "notice" }],
    ports: [
      { portId: corePortId(boundaryNodeId, "psi"), label: "外Ψ", direction: "input", connectionStatus: "unconnected", cardinality: "one" },
      { portId: corePortId(boundaryNodeId, "children"), label: "内Ψ", direction: "output", connectionStatus: "unconnected", cardinality: "many" },
      { portId: corePortId(boundaryNodeId, "return"), label: "内λ", direction: "input", connectionStatus: "unconnected", cardinality: "many" },
      { portId: corePortId(boundaryNodeId, "fam"), label: "外λ", direction: "output", connectionStatus: "unconnected", cardinality: "one" },
    ],
    value: { sourceUnit: parent.value, childFamRef: fam.fam_id, childRevisionRef: fam.revision_id },
    evidenceRefs: [`${accessMap.famId}@${accessMap.revisionId}`],
    canExecute: false,
    canCancel: true,
    foldRef: parent.foldRef,
    ...(parent.parentFoldRef ? { parentFoldRef: parent.parentFoldRef } : {}),
    ...(parent.parentNodeId ? { parentNodeId: parent.parentNodeId } : {}),
    depth: boundaryDepth,
    revisionRef: fam.revision_id,
    projectionFreshness: "unknown",
    foldBoundary: { boundaryRef, rootFoldRef: parent.foldRef, childFoldRefs: [], resolutionMode: "atomic-resolution", dispatchMode: "single-processing-unit", closesAxes: ["G", "D", "L", "mL"], generation, status: "running", boundaryMetrics: deriveFoldBoundaryMetrics({ directChildNodeRefs: [], contextDimensionRefs: units.flatMap((unit) => unit.classification.dimensionRef ?? []), nestingPathDepths: [gravityDepth], technologyNodeRefs: [], technologyChainEdges: [], requiredTechnologyRoutes: [], metaContextNodeRefs: [], metaContextChainEdges: [], nodePluginAvailable: true, exitAdapterRef: "adapter://fquery/playground/lambda-fixture-projection" }), width: boundaryWidth, height: boundaryHeight },
    presentation: boundaryPresentation,
  };
  session.applyEngineEvent({ type: "fam.node.changed", node: boundaryNode });
  session.applyEngineEvent({ type: "presentation.changed", targetRef: boundaryNodeId, projection: boundaryPresentation });
  const childNodeIds: string[] = [];
  const childFoldRefs: string[] = [];
  for (const unit of units) {
    graphSequence += 1;
    const nodeId = await addCoreNode(session, "core.gradient.famvim", graphSequence);
    if (!nodeId) continue;
    childNodeIds.push(nodeId);
    childFoldRefs.push(unit.unitRef);
    const node = session.state.nodes.find((candidate) => candidate.nodeId === nodeId)!;
    session.applyEngineEvent({ type: "fam.node.changed", node: {
      ...node,
      label: `↳ ∇φ-${unit.order + 1}`,
      foldRef: unit.unitRef,
      parentFoldRef: parent.foldRef,
      parentNodeId: boundaryNodeId,
      depth: boundaryDepth + 1,
      collapsed: false,
      revisionRef: unit.unitRevisionRef,
      projectionFreshness: "fresh",
      value: { unit: unit.value, classification: unit.classification, sourcePointer: unit.sourcePointer, recursiveParentFamRef: fam.fam_id },
      badges: [{ axis: "recursive", value: "child", tone: "notice" }, { axis: "classification", value: unit.classification.dimensionRef ?? "unmapped", tone: unit.classification.status === "mapped" ? "active" : "unknown" }],
      evidenceRefs: [`${accessMap.famId}@${accessMap.revisionId}`, `parent-fold://${parent.foldRef}`],
    } });
    await session.dispatch({
      type: "node.move.requested",
      requestId: `playground:layout-recursive:${graphSequence}`,
      nodeId,
      layoutSlotRef: layoutSlotRef(nodeId),
      x: 60,
      y: 100 + unit.order * 320,
    });
    await session.dispatch({ type: "connection.add.requested", requestId: `playground:connect-boundary-child:${graphSequence}`, fromPortId: corePortId(boundaryNodeId, "children"), toPortId: corePortId(nodeId, "psi") });
    await session.dispatch({ type: "connection.add.requested", requestId: `playground:connect-child-return:${graphSequence}`, fromPortId: corePortId(nodeId, "fam"), toPortId: corePortId(boundaryNodeId, "return") });
  }
  session.applyEngineEvent({ type: "fam.node.changed", node: {
    ...boundaryNode,
    badges: [{ axis: "fold", value: "complete", tone: "success" }],
    projectionFreshness: "fresh",
    foldBoundary: { ...boundaryNode.foldBoundary!, childFoldRefs: Object.freeze(childFoldRefs), status: "complete", boundaryMetrics: deriveFoldBoundaryMetrics({ directChildNodeRefs: childFoldRefs, contextDimensionRefs: units.flatMap((unit) => unit.classification.dimensionRef ?? []), nestingPathDepths: [gravityDepth], technologyNodeRefs: [], technologyChainEdges: [], requiredTechnologyRoutes: [], metaContextNodeRefs: childFoldRefs, metaContextChainEdges: [], nodePluginAvailable: true, exitAdapterRef: "adapter://fquery/playground/lambda-fixture-projection" }) },
  } });
  return Object.freeze({ boundaryNodeId, childNodeIds: Object.freeze(childNodeIds), replacedNode: parent });
}

/** presentation depthではなく、実際に跨いだancestor boundaryだけをGとして数える。 */
function foldBoundaryAncestorCount(session: PresentationSession, nodeId: string): number {
  let count = 0;
  let current = session.state.nodes.find((node) => node.nodeId === nodeId);
  const visited = new Set<string>();
  while (current?.parentNodeId) {
    if (visited.has(current.parentNodeId)) throw new TypeError("fold-boundary-parent-cycle");
    visited.add(current.parentNodeId);
    const parent = session.state.nodes.find((node) => node.nodeId === current!.parentNodeId);
    if (!parent) throw new TypeError("fold-boundary-parent-not-found");
    if (parent.foldBoundary) count += 1;
    current = parent;
  }
  return count;
}

/** unit編集後、node identityとlayoutを維持したまま値・classification・revisionだけを再投影する。 */
export function refreshDecompositionNodes(session: PresentationSession, current: CoreNodeIds, fam: FamJsonRecord, accessMap: AccessMapProfile, reprojection?: FoldReprojectionResult): void {
  const byFold = new Map(projectDecompositionUnits(fam, accessMap).map((unit) => [unit.unitRef, unit]));
  for (const nodeId of current.gradients ?? []) {
    const node = session.state.nodes.find((candidate) => candidate.nodeId === nodeId);
    const unit = node?.foldRef ? byFold.get(node.foldRef) : undefined;
    if (!node || !unit) continue;
    session.applyEngineEvent({
      type: "fam.node.changed",
      node: {
        ...node,
        revisionRef: unit.unitRevisionRef,
        projectionFreshness: reprojection?.affectedFoldRefs.includes(unit.unitRef) ? (reprojection.stale ? "stale" : "fresh") : "fresh",
        value: { unit: unit.value, classification: unit.classification, sourcePointer: unit.sourcePointer },
        badges: [
          ...node.badges.filter((badge) => badge.axis === "edit" || badge.axis === "recursive"),
          { axis: "classification", value: unit.classification.dimensionRef ?? "unmapped", tone: unit.classification.status === "mapped" ? "active" : "unknown" },
          ...(reprojection?.affectedFoldRefs.includes(unit.unitRef) ? [{ axis: "projection", value: reprojection.projectionStatus, tone: reprojection.stale ? "warning" as const : "active" as const }] : []),
        ],
      },
    });
  }
}

async function layoutDecomposition(session: PresentationSession, psi: string | undefined, gradients: readonly string[], lambda: string | undefined): Promise<void> {
  const middle = Math.max(0, (gradients.length - 1) * 150);
  const positions = [
    ...(psi ? [{ nodeId: psi, x: 40, y: 80 + middle }] : []),
    ...gradients.map((nodeId, index) => ({ nodeId, x: 420, y: 80 + index * 300 })),
    ...(lambda ? [{ nodeId: lambda, x: 800, y: 80 + middle }] : []),
  ];
  for (const position of positions) {
    graphSequence += 1;
    await session.dispatch({ type: "node.move.requested", requestId: `playground:layout-decomposition:${graphSequence}`, nodeId: position.nodeId, layoutSlotRef: layoutSlotRef(position.nodeId), x: position.x, y: position.y });
  }
}

let placementSequence = 0;

/**
 * Host責務: acceptされたlayoutが無いnodeをviewport中央へ置く。複数あれば縦へずらす。
 * 位置はPresentation FAMではなくlayout write-backとしてsessionへ通す。
 */
export async function placeUnplacedNodes(session: PresentationSession, state: PresentationSessionState, center: { x: number; y: number }): Promise<void> {
  const placed = new Set(state.layout.map((entry) => entry.nodeId));
  const unplaced = state.nodes.filter((node) => !placed.has(node.nodeId));
  const occupied = state.layout.map((entry) => ({ x: entry.x, y: entry.y }));
  for (const node of unplaced) {
    const position = nextFreeSlot(occupied, { x: Math.round(center.x - NODE_WIDTH / 2), y: Math.round(center.y - 60) });
    occupied.push(position);
    placementSequence += 1;
    await session.dispatch({
      type: "node.move.requested",
      requestId: `playground:place:${placementSequence}`,
      nodeId: node.nodeId,
      layoutSlotRef: layoutSlotRef(node.nodeId),
      x: position.x,
      y: position.y,
    });
  }
}

const NODE_WIDTH = 320;
const NODE_HEIGHT = 260;
const PLACEMENT_STEP = 180;

/** 既存nodeの矩形と重なる間は下へずらす。Host側の便宜であり、canonical layoutではない。 */
export function nextFreeSlot(occupied: readonly { x: number; y: number }[], start: { x: number; y: number }): { x: number; y: number } {
  const candidate = { ...start };
  const overlaps = () => occupied.some((slot) => Math.abs(slot.x - candidate.x) < NODE_WIDTH && Math.abs(slot.y - candidate.y) < NODE_HEIGHT);
  let guard = 0;
  while (overlaps() && guard < 50) { candidate.y += PLACEMENT_STEP; guard += 1; }
  return candidate;
}
