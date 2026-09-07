import { corePortId, type PresentationSession, type PresentationSessionState } from "@fquery/ui-core";

export interface CoreNodeIds {
  readonly psi?: string | undefined;
  readonly famvim?: string | undefined;
  readonly lambda?: string | undefined;
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
