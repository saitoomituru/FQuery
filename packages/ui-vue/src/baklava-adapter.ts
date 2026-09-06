import { Editor, NodeInterface, defineNode, type AbstractNode, type Connection } from "@baklavajs/core";
import type { ConnectionViewModel, GuiEventAbi, NodeViewModel } from "@fquery/ui-core";

export interface BaklavaLayoutValue {
  readonly nodeId: string;
  readonly x: number;
  readonly y: number;
}

interface ProjectedNode {
  readonly node: AbstractNode;
  readonly portSignature: string;
  acceptedPosition?: BaklavaLayoutValue;
}

export class BaklavaPresentationAdapter {
  readonly editor = new Editor();
  readonly #nodes = new Map<string, ProjectedNode>();
  readonly #connections = new Map<string, Connection>();
  readonly #emit: (event: GuiEventAbi) => void;
  #requestSequence = 0;
  #projecting = false;

  constructor(emit: (event: GuiEventAbi) => void) {
    this.#emit = emit;
    this.editor.graphEvents.beforeAddConnection.subscribe(this, (data, prevent) => {
      if (this.#projecting) return;
      prevent();
      this.#requestSequence += 1;
      this.#emit({
        type: "connection.add.requested",
        requestId: `ui:connection:${this.#requestSequence}`,
        fromPortId: data.from.id,
        toPortId: data.to.id,
      });
    });
  }

  sync(
    nodes: readonly NodeViewModel[],
    connections: readonly ConnectionViewModel[] = [],
    layout: readonly BaklavaLayoutValue[] = [],
  ): void {
    const nextNodeIds = new Set(nodes.map((node) => node.nodeId));
    for (const [nodeId, projected] of this.#nodes) {
      if (nextNodeIds.has(nodeId)) continue;
      this.editor.graph.removeNode(projected.node);
      this.#nodes.delete(nodeId);
    }

    const layoutByNode = new Map(layout.map((value) => [value.nodeId, value]));
    for (const model of nodes) {
      const signature = portSignature(model);
      let projected = this.#nodes.get(model.nodeId);
      if (projected && projected.portSignature !== signature) {
        this.editor.graph.removeNode(projected.node);
        this.#nodes.delete(model.nodeId);
        projected = undefined;
      }
      if (!projected) {
        projected = this.#addNode(model, signature);
      } else if (projected.node.title !== model.label) {
        projected.node.title = model.label;
      }
      const position = layoutByNode.get(model.nodeId);
      if (position) {
        setNodePosition(projected.node, position.x, position.y);
        projected.acceptedPosition = position;
      }
    }

    this.#syncConnections(connections);
  }

  requestMovedNodes(nodes: readonly NodeViewModel[]): void {
    const modelById = new Map(nodes.map((node) => [node.nodeId, node]));
    for (const [nodeId, projected] of this.#nodes) {
      const accepted = projected.acceptedPosition;
      const model = modelById.get(nodeId);
      const layoutSlotRef = model?.presentation?.presentation?.layoutSlotRef;
      if (!accepted || !layoutSlotRef) continue;
      const position = getNodePosition(projected.node);
      if (position.x === accepted.x && position.y === accepted.y) continue;
      this.#requestSequence += 1;
      this.#emit({
        type: "node.move.requested",
        requestId: `ui:move:${this.#requestSequence}`,
        nodeId,
        layoutSlotRef,
        x: position.x,
        y: position.y,
      });
      setNodePosition(projected.node, accepted.x, accepted.y);
    }
  }

  #addNode(model: NodeViewModel, signature: string): ProjectedNode {
    const inputs = Object.fromEntries(model.ports.filter((port) => port.direction === "input").map((port) => [
      port.portId,
      () => new NodeInterface<unknown>(port.label, null),
    ]));
    const outputs = Object.fromEntries(model.ports.filter((port) => port.direction === "output").map((port) => [
      port.portId,
      () => new NodeInterface<unknown>(port.label, null),
    ]));
    const NodeType = defineNode<Record<string, unknown>, Record<string, unknown>>({
      type: `fquery-projection:${model.nodeId}`,
      title: model.label,
      inputs,
      outputs,
    });
    this.editor.registerNodeType(NodeType, {
      title: model.label,
      ...(model.presentation?.presentation?.category ? { category: model.presentation.presentation.category } : {}),
    });
    const node = new NodeType();
    node.id = model.nodeId;
    for (const [portId, intf] of [...Object.entries(node.inputs), ...Object.entries(node.outputs)]) intf.id = portId;
    this.editor.graph.addNode(node);
    const projected = { node, portSignature: signature };
    this.#nodes.set(model.nodeId, projected);
    return projected;
  }

  #syncConnections(connections: readonly ConnectionViewModel[]): void {
    const nextConnectionIds = new Set(connections.map((connection) => connection.connectionId));
    for (const [connectionId, connection] of this.#connections) {
      if (nextConnectionIds.has(connectionId)) continue;
      this.editor.graph.removeConnection(connection);
      this.#connections.delete(connectionId);
    }
    this.#projecting = true;
    try {
      for (const model of connections) {
        if (this.#connections.has(model.connectionId)) continue;
        const from = this.editor.graph.findNodeInterface(model.fromPortId);
        const to = this.editor.graph.findNodeInterface(model.toPortId);
        if (!from || !to) continue;
        const connection = this.editor.graph.addConnection(from, to);
        if (connection) this.#connections.set(model.connectionId, connection);
      }
    } finally {
      this.#projecting = false;
    }
  }
}

function portSignature(model: NodeViewModel): string {
  return model.ports.map((port) => `${port.direction}:${port.portId}:${port.label}`).join("|");
}

function getNodePosition(node: AbstractNode): { x: number; y: number } {
  return (node as AbstractNode & { position?: { x: number; y: number } }).position ?? { x: 0, y: 0 };
}

function setNodePosition(node: AbstractNode, x: number, y: number): void {
  (node as AbstractNode & { position: { x: number; y: number } }).position = { x, y };
}
