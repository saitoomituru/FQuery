import { describe, expect, it } from "vitest";
import type { GuiEventAbi, NodeViewModel } from "@fquery/ui-core";
import { BaklavaPresentationAdapter } from "../src/baklava-adapter.js";

const source: NodeViewModel = {
  nodeId: "fam://sensor",
  label: "Sensor",
  badges: [],
  ports: [{ portId: "sensor:out", label: "reading", direction: "output", connectionStatus: "connected" }],
  value: null,
  evidenceRefs: [],
  canExecute: false,
  canCancel: false,
  presentation: {
    targetRef: "fam://sensor",
    mode: "native",
    rendererId: "baklava-vue",
    presentation: {
      schemaVersion: "fquery.presentation-fam/0.1.0-draft",
      presentationId: "presentation://sensor",
      targetRef: "fam://sensor",
      surfaces: ["node-editor"],
      visualRole: "sensor",
      interfaceRoles: ["source"],
      visibility: "visible",
      layoutSlotRef: "ibd://layout/sensor",
    },
  },
};

const sink: NodeViewModel = {
  nodeId: "fam://output",
  label: "Output",
  badges: [],
  ports: [{ portId: "output:in", label: "value", direction: "input", connectionStatus: "connected" }],
  value: null,
  evidenceRefs: [],
  canExecute: false,
  canCancel: false,
};

describe("Baklava Presentation Adapter", () => {
  it("canonical NodeViewModelをBaklava graphへ一方向投影しengineを持たない", () => {
    const adapter = new BaklavaPresentationAdapter(() => undefined);
    adapter.sync([source, sink], [{ connectionId: "connection://accepted", fromPortId: "sensor:out", toPortId: "output:in" }]);

    expect(adapter.editor.graph.nodes.map((node) => node.id)).toEqual(["fam://sensor", "fam://output"]);
    expect(adapter.editor.graph.nodes.flatMap((node) => [...Object.values(node.inputs), ...Object.values(node.outputs)]).map((port) => port.nodeId)).toEqual(["fam://sensor", "fam://output"]);
    expect(adapter.editor.graph.connections).toHaveLength(1);
    expect(adapter.editor.graph.nodes.every((node) => node.calculate === undefined)).toBe(true);
  });

  it("Baklava接続gestureを直接確定せずGUI Event ABIへ変換する", () => {
    const events: GuiEventAbi[] = [];
    const adapter = new BaklavaPresentationAdapter((event) => events.push(event));
    adapter.sync([source, sink]);
    const from = adapter.editor.graph.findNodeInterface("sensor:out");
    const to = adapter.editor.graph.findNodeInterface("output:in");
    expect(from).toBeDefined();
    expect(to).toBeDefined();

    const result = adapter.editor.graph.addConnection(from!, to!);
    expect(result).toBeUndefined();
    expect(adapter.editor.graph.connections).toHaveLength(0);
    expect(events).toEqual([expect.objectContaining({
      type: "connection.add.requested",
      fromPortId: "sensor:out",
      toPortId: "output:in",
    })]);
  });

  it("engine側から消えたnodeだけをprojectionから除去する", () => {
    const adapter = new BaklavaPresentationAdapter(() => undefined);
    adapter.sync([source, sink]);
    const retained = adapter.editor.graph.findNodeById("fam://sensor");
    adapter.sync([source]);

    expect(adapter.editor.graph.nodes).toHaveLength(1);
    expect(adapter.editor.graph.findNodeById("fam://sensor")).toBe(retained);
    expect(adapter.editor.graph.findNodeById("fam://output")).toBeUndefined();
  });

  it("node移動をlayout write-back requestへ変換して確定位置へ戻す", () => {
    const events: GuiEventAbi[] = [];
    const adapter = new BaklavaPresentationAdapter((event) => events.push(event));
    adapter.sync([source], [], [{ nodeId: "fam://sensor", x: 10, y: 20 }]);
    const node = adapter.editor.graph.findNodeById("fam://sensor") as typeof adapter.editor.graph.nodes[number] & { position: { x: number; y: number } };
    node.position = { x: 80, y: 120 };

    adapter.requestMovedNodes([source]);

    expect(events).toEqual([expect.objectContaining({
      type: "node.move.requested",
      nodeId: "fam://sensor",
      layoutSlotRef: "ibd://layout/sensor",
      x: 80,
      y: 120,
    })]);
    expect(node.position).toEqual({ x: 10, y: 20 });
  });

  it("node座標の確定と差戻しでconnectionを再投影する", () => {
    const adapter = new BaklavaPresentationAdapter(() => undefined);
    const connection = { connectionId: "connection://accepted", fromPortId: "sensor:out", toPortId: "output:in" };
    adapter.sync([source, sink], [connection], [
      { nodeId: "fam://sensor", x: 10, y: 20 },
      { nodeId: "fam://output", x: 300, y: 20 },
    ]);
    const initialConnection = adapter.editor.graph.connections[0];

    adapter.sync([source, sink], [connection], [
      { nodeId: "fam://sensor", x: 80, y: 120 },
      { nodeId: "fam://output", x: 300, y: 20 },
    ]);
    const acceptedConnection = adapter.editor.graph.connections[0];
    expect(acceptedConnection).not.toBe(initialConnection);

    const node = adapter.editor.graph.findNodeById("fam://sensor") as typeof adapter.editor.graph.nodes[number] & { position: { x: number; y: number } };
    node.position = { x: 160, y: 240 };
    adapter.requestMovedNodes([source, sink]);

    expect(node.position).toEqual({ x: 80, y: 120 });
    expect(adapter.editor.graph.connections).toHaveLength(1);
    expect(adapter.editor.graph.connections[0]).not.toBe(acceptedConnection);
  });
});
