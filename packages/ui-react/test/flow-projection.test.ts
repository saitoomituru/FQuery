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

  it("atomic Fold boundaryを親としてchild graphをネスト投影する", () => {
    const boundary: NodeViewModel = { ...node("boundary", []), foldBoundary: { boundaryRef: "fold-boundary://1", rootFoldRef: "fold://root", childFoldRefs: ["fold://child"], resolutionMode: "atomic-resolution", dispatchMode: "single-processing-unit", closesAxes: ["G", "D", "L", "mL"], generation: 1, status: "complete", boundaryMetrics: { G: { max: 1, median: 1, min: 1 }, D: 1, L: { max: 0, median: 0, min: 0, continuity: "not-declared", broken_route_refs: [] }, mL: { max: 1, median: 1, min: 1 }, direct_child_count: 1, S: { socket_present: true, adapter_ref: "adapter://lambda", on_missing: "last-order" } }, width: 760, height: 420 } };
    const child: NodeViewModel = { ...node("child", []), parentNodeId: "boundary", parentFoldRef: "fold://root" };
    const projection = projectFlow({ nodes: [boundary, child], connections: [], layout: [{ nodeId: "boundary", x: 100, y: 100 }, { nodeId: "child", x: 30, y: 80 }], selection: { nodeIds: [] } });
    expect(projection.nodes[0]).toMatchObject({ id: "boundary", type: "foldBoundary", style: { width: 760, height: 420 } });
    expect(projection.nodes[1]).toMatchObject({ id: "child", type: "fquery", parentId: "boundary", extent: "parent", position: { x: 30, y: 80 } });
  });
});
