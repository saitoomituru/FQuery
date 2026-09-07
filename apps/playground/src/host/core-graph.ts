import { corePortId, type PresentationSession, type PresentationSessionState } from "@fquery/ui-core";
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

/** recursive Whyの子decompositionを、親unit identityを保った階層nodeとして追加する。 */
export async function projectRecursiveDecompositionGraph(
  session: PresentationSession,
  parentNodeId: string,
  fam: FamJsonRecord,
  accessMap: AccessMapProfile,
): Promise<readonly string[]> {
  const parent = session.state.nodes.find((node) => node.nodeId === parentNodeId);
  if (!parent?.foldRef) throw new TypeError("recursive-parent-fold-ref-required");
  const parentLayout = session.state.layout.find((entry) => entry.nodeId === parentNodeId);
  const childNodeIds: string[] = [];
  for (const unit of projectDecompositionUnits(fam, accessMap)) {
    graphSequence += 1;
    const nodeId = await addCoreNode(session, "core.gradient.famvim", graphSequence);
    if (!nodeId) continue;
    childNodeIds.push(nodeId);
    const node = session.state.nodes.find((candidate) => candidate.nodeId === nodeId)!;
    session.applyEngineEvent({ type: "fam.node.changed", node: {
      ...node,
      label: `↳ ∇φ-${unit.order + 1}`,
      foldRef: unit.unitRef,
      parentFoldRef: parent.foldRef,
      depth: (parent.depth ?? 0) + 1,
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
      x: (parentLayout?.x ?? 420) + 360,
      y: (parentLayout?.y ?? 80) + unit.order * 280,
    });
  }
  return Object.freeze(childNodeIds);
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
