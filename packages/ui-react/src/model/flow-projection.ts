import type { ConnectionViewModel, LayoutValue, NodeSelection, NodeViewModel } from "@fquery/ui-core";

/**
 * React Flowへ渡す投影。この層はDOM／React Flow runtimeを知らない純関数であり、
 * canonical stateはsession側に残る。React Flowのnode/edge objectを正本にしない。
 */
export interface FlowNodeProjection {
  readonly id: string;
  readonly type: "fquery";
  readonly position: { readonly x: number; readonly y: number };
  readonly selected: boolean;
  /** layout write-backが未確定のnode。Hostが配置するまで既定位置に置く。 */
  readonly unplaced: boolean;
  readonly data: { readonly nodeId: string };
}

export interface FlowEdgeProjection {
  readonly id: string;
  readonly source: string;
  readonly sourceHandle: string;
  readonly target: string;
  readonly targetHandle: string;
}

export interface FlowProjection {
  readonly nodes: readonly FlowNodeProjection[];
  readonly edges: readonly FlowEdgeProjection[];
  /** portId -> nodeId。connection gestureのhandle idからnodeを引き直すための表。 */
  readonly portOwner: ReadonlyMap<string, string>;
}

export interface FlowProjectionInput {
  readonly nodes: readonly NodeViewModel[];
  readonly connections: readonly ConnectionViewModel[];
  readonly layout: readonly LayoutValue[];
  readonly selection: NodeSelection;
  /** drag中だけ存在する暫定座標。accepted layoutより優先する。 */
  readonly draft?: ReadonlyMap<string, { readonly x: number; readonly y: number }>;
}

const UNPLACED_POSITION = Object.freeze({ x: 0, y: 0 });

export function projectFlow(input: FlowProjectionInput): FlowProjection {
  const layoutByNode = new Map(input.layout.map((value) => [value.nodeId, value]));
  const selected = new Set(input.selection.nodeIds);
  const portOwner = new Map<string, string>();
  for (const node of input.nodes) for (const port of node.ports) portOwner.set(port.portId, node.nodeId);

  const nodes = input.nodes.map((node): FlowNodeProjection => {
    const draft = input.draft?.get(node.nodeId);
    const accepted = layoutByNode.get(node.nodeId);
    const position = draft ?? (accepted ? { x: accepted.x, y: accepted.y } : UNPLACED_POSITION);
    return Object.freeze({
      id: node.nodeId,
      type: "fquery",
      position: Object.freeze({ x: position.x, y: position.y }),
      selected: selected.has(node.nodeId),
      unplaced: accepted === undefined,
      data: Object.freeze({ nodeId: node.nodeId }),
    });
  });

  const edges: FlowEdgeProjection[] = [];
  for (const connection of input.connections) {
    const source = portOwner.get(connection.fromPortId);
    const target = portOwner.get(connection.toPortId);
    // 片端のportが存在しないconnectionは描画しない。canonical側の状態は変えない
    if (!source || !target) continue;
    edges.push(Object.freeze({
      id: connection.connectionId,
      source,
      sourceHandle: connection.fromPortId,
      target,
      targetHandle: connection.toPortId,
    }));
  }

  return Object.freeze({ nodes: Object.freeze(nodes), edges: Object.freeze(edges), portOwner });
}
