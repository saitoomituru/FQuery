import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createLiteralDecompositionFam, readAccessMapProfile, readFamJson, type AccessMapProfile } from "@fquery/fam-core";
import { buildCoreGraph, projectDecompositionGraph } from "../src/host/core-graph.js";
import { createPlaygroundSession } from "../src/host/session.js";

const baseAccessMap = readAccessMapProfile(readFamJson(readFileSync(resolve(process.cwd(), "../../fixtures/test-cases/basic-commons-access-mapper/access-map.fam.json"), "utf8")).value);

describe("Playground semantic topology projection", () => {
  it("選択branchのmL鎖だけをroot Fold内へ投影し別branchを保持する", async () => {
    const { session } = createPlaygroundSession();
    const ids = await buildCoreGraph(session);
    const fam = structuredClone(createLiteralDecompositionFam("前提A。前提B。判断。結論。", "q://test/playground/topology"));
    const units = (fam.λ as { output_units: Array<{ Q: { unit_ref: string } }> }).output_units;
    (fam.Q as Record<string, unknown>).provider_graphs = [
      {
        id: "branch://fact-domain",
        by: "observer://human/fact-reading",
        links: [
          { from: units[0]!.Q.unit_ref, to: units[2]!.Q.unit_ref, chain_axis: "mL", kind: "causal", receipts: ["oae://human/fact/1"] },
          { from: units[1]!.Q.unit_ref, to: units[2]!.Q.unit_ref, chain_axis: "mL", kind: "causal", receipts: ["oae://human/fact/2"] },
          { from: units[2]!.Q.unit_ref, to: units[3]!.Q.unit_ref, chain_axis: "mL", kind: "dependency", receipts: ["oae://human/fact/3"] },
        ],
      },
      { id: "branch://astral-reading", by: "observer://human/astral-reading", links: [] },
    ];
    const accessMap: AccessMapProfile = {
      ...baseAccessMap,
      semanticTopologyContract: {
        branchesPointer: "/Q/provider_graphs",
        selectedBranchRef: "branch://fact-domain",
        selectionScopeRef: "scope://test/presentation-only",
        fields: { branchRef: "id", observerRef: "by", relations: "links", fromUnitRef: "from", toUnitRef: "to", axis: "chain_axis", relationKind: "kind", evidenceRefs: "receipts" },
      },
    };
    const projected = await projectDecompositionGraph(session, ids, fam, accessMap);
    const boundary = session.state.nodes.find((node) => node.nodeId === projected.famvim)!;
    expect(boundary.foldBoundary).toMatchObject({ rootFoldRef: fam.fam_id, childFoldRefs: units.map((unit) => unit.Q.unit_ref), boundaryMetrics: { G: { max: 0 }, mL: { max: 3, median: 3, min: 3 } } });
    expect(boundary.value).toMatchObject({ semanticTopology: { status: "selected", branches: [{ branchRef: "branch://fact-domain" }, { branchRef: "branch://astral-reading" }] } });
    const nodeByFold = new Map(session.state.nodes.flatMap((node) => node.foldRef ? [[node.foldRef, node]] : []));
    const foldByNodeId = new Map(session.state.nodes.flatMap((node) => node.foldRef ? [[node.nodeId, node.foldRef]] : []));
    expect(units.every((unit) => nodeByFold.get(unit.Q.unit_ref)?.parentNodeId === boundary.nodeId)).toBe(true);
    const semantic = session.state.connections.filter((connection) => connection.relationKind === "causal" || connection.relationKind === "dependency");
    expect(semantic.map((connection) => [foldByNodeId.get(connection.fromPortId.replace(/:fam$/, "")), foldByNodeId.get(connection.toPortId.replace(/:psi$/, ""))])).toEqual([
      [units[0]!.Q.unit_ref, units[2]!.Q.unit_ref],
      [units[1]!.Q.unit_ref, units[2]!.Q.unit_ref],
      [units[2]!.Q.unit_ref, units[3]!.Q.unit_ref],
    ]);
    expect(session.state.connections.some((connection) => ids.psi && connection.fromPortId.startsWith(`${ids.psi}:`) && projected.gradients?.some((nodeId) => connection.toPortId.startsWith(`${nodeId}:`)))).toBe(false);
  });
});
