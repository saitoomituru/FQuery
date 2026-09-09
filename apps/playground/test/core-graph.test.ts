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

  it("parent-child関係を外内gate付きnested Foldへ投影しroot直結しない", async () => {
    const { session } = createPlaygroundSession();
    const ids = await buildCoreGraph(session);
    const fam = structuredClone(createLiteralDecompositionFam("技術観測。対象評価。本人記憶。現在判断。", "q://test/playground/nested-topology"));
    const units = (fam.λ as { output_units: Array<{ Q: { unit_ref: string } }> }).output_units;
    (fam.Q as Record<string, unknown>).semantic_topology_branches = [{
      branch_ref: "branch://fquery/decomposition/primary",
      observer_ref: "observer://human/astral-reading",
      relations: [
        { from_unit_ref: units[0]!.Q.unit_ref, to_unit_ref: units[2]!.Q.unit_ref, axis: "mL", relation_kind: "causal", evidence_refs: ["oae://human/reading/1"] },
        { from_unit_ref: units[1]!.Q.unit_ref, to_unit_ref: units[2]!.Q.unit_ref, axis: "mL", relation_kind: "causal", evidence_refs: ["oae://human/reading/2"] },
        { from_unit_ref: units[2]!.Q.unit_ref, to_unit_ref: units[3]!.Q.unit_ref, axis: "mL", relation_kind: "parent-child", evidence_refs: ["oae://human/reading/3"] },
      ],
    }];
    // provider配列でchildがparentより先でも、React Flow投影はparent-firstに正規化する。
    (fam.λ as { output_units: typeof units }).output_units = [units[3]!, units[0]!, units[1]!, units[2]!];

    const projected = await projectDecompositionGraph(session, ids, fam, baseAccessMap);
    const nodeByFold = new Map(session.state.nodes.flatMap((node) => node.foldRef ? [[node.foldRef, node]] : []));
    const root = session.state.nodes.find((node) => node.nodeId === projected.famvim)!;
    const nestedBoundary = nodeByFold.get(units[2]!.Q.unit_ref)!;
    const nestedChild = nodeByFold.get(units[3]!.Q.unit_ref)!;

    expect(root.foldBoundary).toMatchObject({ childFoldRefs: [units[0]!.Q.unit_ref, units[1]!.Q.unit_ref, units[2]!.Q.unit_ref], boundaryMetrics: { direct_child_count: 3 } });
    expect(nestedBoundary.foldBoundary).toMatchObject({ rootFoldRef: units[2]!.Q.unit_ref, childFoldRefs: [units[3]!.Q.unit_ref], boundaryMetrics: { G: { max: 1 }, direct_child_count: 1 } });
    expect(nestedBoundary.ports.map((port) => port.label)).toEqual(["外Ψ", "内Ψ", "内λ", "外λ"]);
    expect(nestedBoundary.ports[0]?.cardinality).toBe("many");
    expect(nestedChild.parentNodeId).toBe(nestedBoundary.nodeId);
    expect(projected.gradients!.indexOf(nestedBoundary.nodeId)).toBeLessThan(projected.gradients!.indexOf(nestedChild.nodeId));
    expect(session.state.connections.some((connection) => connection.fromPortId === `${root.nodeId}:children` && connection.toPortId === `${nestedChild.nodeId}:psi`)).toBe(false);
    expect(session.state.connections).toEqual(expect.arrayContaining([
      expect.objectContaining({ fromPortId: `${nestedBoundary.nodeId}:children`, toPortId: `${nestedChild.nodeId}:psi`, relationKind: "parent-child" }),
      expect.objectContaining({ fromPortId: `${nestedChild.nodeId}:fam`, toPortId: `${nestedBoundary.nodeId}:return`, relationKind: "parent-child" }),
    ]));
    expect(session.state.connections.filter((connection) => connection.toPortId === `${nestedBoundary.nodeId}:psi` && connection.relationKind === "causal")).toHaveLength(2);
  });
});
