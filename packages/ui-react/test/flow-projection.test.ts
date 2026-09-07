import { describe, expect, it } from "vitest";
import type { NodeViewModel } from "@fquery/ui-core";
import { projectFlow } from "../src/model/flow-projection.js";

const node = (nodeId: string, ports: NodeViewModel["ports"]): NodeViewModel => ({
  nodeId,
  label: nodeId,
  badges: [],
  ports,
  value: null,
  evidenceRefs: [],
  canExecute: false,
  canCancel: false,
});

describe("projectFlow", () => {
  const source = node("fam://sensor", [{ portId: "fam://sensor:out", label: "out", direction: "output", connectionStatus: "connected" }]);
  const sink = node("fam://output", [{ portId: "fam://output:in", label: "in", direction: "input", connectionStatus: "connected" }]);

  it("layoutとselectionをnodeへ、connectionをhandle付きedgeへ投影する", () => {
    const projection = projectFlow({
      nodes: [source, sink],
      connections: [{ connectionId: "connection://accepted", fromPortId: "fam://sensor:out", toPortId: "fam://output:in" }],
      layout: [{ nodeId: "fam://sensor", x: 10, y: 20 }],
      selection: { nodeIds: ["fam://output"], activeNodeId: "fam://output" },
    });
    expect(projection.nodes).toEqual([
      { id: "fam://sensor", type: "fquery", position: { x: 10, y: 20 }, selected: false, unplaced: false, data: { nodeId: "fam://sensor" } },
      { id: "fam://output", type: "fquery", position: { x: 0, y: 0 }, selected: true, unplaced: true, data: { nodeId: "fam://output" } },
    ]);
    expect(projection.edges).toEqual([
      { id: "connection://accepted", source: "fam://sensor", sourceHandle: "fam://sensor:out", target: "fam://output", targetHandle: "fam://output:in" },
    ]);
    expect(projection.portOwner.get("fam://output:in")).toBe("fam://output");
  });

  it("draft座標はaccepted layoutより優先する", () => {
    const projection = projectFlow({
      nodes: [source],
      connections: [],
      layout: [{ nodeId: "fam://sensor", x: 10, y: 20 }],
      selection: { nodeIds: [] },
      draft: new Map([["fam://sensor", { x: 250, y: 90 }]]),
    });
    expect(projection.nodes[0]?.position).toEqual({ x: 250, y: 90 });
    expect(projection.nodes[0]?.unplaced).toBe(false);
  });

  it("片端のportが無いconnectionは描画しないがcanonical側へは触れない", () => {
    const connections = Object.freeze([{ connectionId: "c", fromPortId: "fam://sensor:out", toPortId: "missing:in" }]);
    const projection = projectFlow({ nodes: [source], connections, layout: [], selection: { nodeIds: [] } });
    expect(projection.edges).toEqual([]);
    expect(connections).toHaveLength(1);
  });
});
