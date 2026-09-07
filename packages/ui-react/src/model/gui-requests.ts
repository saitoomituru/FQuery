import type { GuiEventAbi, NodeSelection, NodeViewModel } from "@fquery/ui-core";

/** GUI gestureを`*.requested`へ変換する。判定はしない。requestIdだけを採番する。 */
export class GuiRequestFactory {
  #sequence = 0;
  readonly #prefix: string;

  constructor(prefix = "ui") {
    this.#prefix = prefix;
  }

  #next(kind: string): string {
    this.#sequence += 1;
    return `${this.#prefix}:${kind}:${this.#sequence}`;
  }

  /** layoutSlotRefを持たないnodeは移動をwrite-backできないので`undefined`を返す。 */
  move(node: NodeViewModel, x: number, y: number): (GuiEventAbi & { type: "node.move.requested" }) | undefined {
    const layoutSlotRef = node.presentation?.presentation?.layoutSlotRef;
    if (!layoutSlotRef) return undefined;
    return { type: "node.move.requested", requestId: this.#next("move"), nodeId: node.nodeId, layoutSlotRef, x, y };
  }

  connect(fromPortId: string, toPortId: string): GuiEventAbi & { type: "connection.add.requested" } {
    return { type: "connection.add.requested", requestId: this.#next("connection"), fromPortId, toPortId };
  }

  select(selection: NodeSelection): GuiEventAbi & { type: "node.select.requested" } {
    return {
      type: "node.select.requested",
      requestId: this.#next("select"),
      nodeIds: selection.nodeIds,
      ...(selection.activeNodeId ? { activeNodeId: selection.activeNodeId } : {}),
    };
  }
}
