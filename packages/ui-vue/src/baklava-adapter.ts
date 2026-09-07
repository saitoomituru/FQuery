import { markRaw } from "vue";
import { Editor, NodeInterface, defineNode, type AbstractNode, type Connection } from "@baklavajs/core";
import type { ConnectionViewModel, GuiEventAbi, NodeViewModel } from "@fquery/ui-core";
import { CONTENT_INTERFACE_KEY } from "./canvas-context.js";
import FQueryCanvasNodeContent from "./FQueryCanvasNodeContent.vue";

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
  /** 描画側（useBaklava）のreactive editorを受け取る。生のEditorへ追加するとmount後の変更が描画へ伝播しない。 */
  readonly editor: Editor;
  readonly #nodes = new Map<string, ProjectedNode>();
  readonly #connections = new Map<string, Connection>();
  readonly #emit: (event: GuiEventAbi) => void;
  readonly nodeWidth: number;
  readonly inlineContent: boolean;
  #requestSequence = 0;
  #projecting = false;
  #connectionModels: readonly ConnectionViewModel[] = [];

  constructor(emit: (event: GuiEventAbi) => void, options: { nodeWidth?: number; inlineContent?: boolean; editor?: Editor } = {}) {
    this.#emit = emit;
    this.editor = options.editor ?? new Editor();
    this.nodeWidth = options.nodeWidth ?? 320;
    this.inlineContent = options.inlineContent ?? false;
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
    this.#connectionModels = connections;
    let requiresConnectionRefresh = false;
    const nextNodeIds = new Set(nodes.map((node) => node.nodeId));
    for (const [nodeId, projected] of this.#nodes) {
      if (nextNodeIds.has(nodeId)) continue;
      this.editor.graph.removeNode(projected.node);
      this.#nodes.delete(nodeId);
      requiresConnectionRefresh = true;
    }

    const layoutByNode = new Map(layout.map((value) => [value.nodeId, value]));
    for (const model of nodes) {
      const signature = portSignature(model);
      let projected = this.#nodes.get(model.nodeId);
      if (projected && projected.portSignature !== signature) {
        this.editor.graph.removeNode(projected.node);
        this.#nodes.delete(model.nodeId);
        projected = undefined;
        requiresConnectionRefresh = true;
      }
      if (!projected) {
        projected = this.#addNode(model, signature);
        requiresConnectionRefresh = true;
      } else if (projected.node.title !== model.label) {
        projected.node.title = model.label;
      }
      const position = layoutByNode.get(model.nodeId);
      if (position) {
        const current = getNodePosition(projected.node);
        if (current.x !== position.x || current.y !== position.y) requiresConnectionRefresh = true;
        setNodePosition(projected.node, position.x, position.y);
        projected.acceptedPosition = position;
      }
    }

    this.#syncConnections(connections, requiresConnectionRefresh);
  }

  requestMovedNodes(nodes: readonly NodeViewModel[]): void {
    const modelById = new Map(nodes.map((node) => [node.nodeId, node]));
    let resetPosition = false;
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
      resetPosition = true;
    }
    if (resetPosition) this.#syncConnections(this.#connectionModels, true);
  }

  #addNode(model: NodeViewModel, signature: string): ProjectedNode {
    const inputs = Object.fromEntries(model.ports.filter((port) => port.direction === "input").map((port) => [
      port.portId,
      () => new NodeInterface<unknown>(port.label, null),
    ]));
    if (this.inlineContent) {
      // node本体はportを持たない非接続interfaceとして描画する（Baklava公式の拡張経路）
      inputs[CONTENT_INTERFACE_KEY] = () => new NodeInterface<unknown>("", null).setPort(false).setComponent(markRaw(FQueryCanvasNodeContent));
    }
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
    (node as AbstractNode & { width?: number }).width = this.nodeWidth;
    for (const [portId, intf] of [...Object.entries(node.inputs), ...Object.entries(node.outputs)]) intf.id = portId === CONTENT_INTERFACE_KEY ? `${model.nodeId}:${CONTENT_INTERFACE_KEY}` : portId;
    this.editor.graph.addNode(node);
    // graph経由で取り直したreactive proxyを保持する。生のnodeへpositionを書くとrendererのdrag／描画へ伝播しない
    const reactiveNode = this.editor.graph.findNodeById(node.id) ?? node;
    const projected = { node: reactiveNode, portSignature: signature };
    this.#nodes.set(model.nodeId, projected);
    return projected;
  }

  #syncConnections(connections: readonly ConnectionViewModel[], forceRefresh = false): void {
    if (forceRefresh) {
      for (const connection of this.#connections.values()) this.editor.graph.removeConnection(connection);
      this.#connections.clear();
    }
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

type PositionedNode = AbstractNode & { position?: { x: number; y: number } };

function getNodePosition(node: AbstractNode): { x: number; y: number } {
  const position = (node as PositionedNode).position;
  return position ? { x: position.x, y: position.y } : { x: 0, y: 0 };
}

/** rendererはposition objectをtoRefで監視するため、objectを置換せずx/yを書き換える。 */
function setNodePosition(node: AbstractNode, x: number, y: number): void {
  const positioned = node as PositionedNode;
  if (!positioned.position) positioned.position = { x, y };
  else { positioned.position.x = x; positioned.position.y = y; }
}
