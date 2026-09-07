import { corePortId, type PresentationSession, type PresentationSessionState } from "@fquery/ui-core";

export interface CoreNodeIds {
  readonly psi?: string | undefined;
  readonly famvim?: string | undefined;
  readonly lambda?: string | undefined;
}

export function layoutSlotRef(nodeId: string): string {
  return `layout://playground-react/${nodeId}`;
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
  for (const [index, node] of unplaced.entries()) {
    placementSequence += 1;
    await session.dispatch({
      type: "node.move.requested",
      requestId: `playground:place:${placementSequence}`,
      nodeId: node.nodeId,
      layoutSlotRef: layoutSlotRef(node.nodeId),
      x: Math.round(center.x - 160),
      y: Math.round(center.y - 60 + index * 140),
    });
  }
}
