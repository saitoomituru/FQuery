import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createLiteralDecompositionFam, readAccessMapProfile, readFamJson, type AccessMapProfile, type FamJsonRecord } from "@fquery/fam-core";
import { buildCoreGraph, projectDecompositionGraph } from "../src/host/core-graph.js";
import { createPlaygroundSession } from "../src/host/session.js";

const baseAccessMap = readAccessMapProfile(readFamJson(readFileSync(resolve(process.cwd(), "../../fixtures/test-cases/basic-commons-access-mapper/access-map.fam.json"), "utf8")).value);
const issue41Source = readFileSync(resolve(process.cwd(), "../../fixtures/test-cases/issue-41/source.ja.txt"), "utf8").trimEnd();

interface Issue41TopologyCase {
  readonly units: readonly string[];
  readonly branches: readonly {
    readonly branch_ref: string;
    readonly observer_ref: string;
    readonly relations: readonly {
      readonly from_unit_order: number;
      readonly to_unit_order: number;
      readonly axis: "L" | "mL";
      readonly relation_kind: "dependency" | "causal" | "conditional" | "parent-child";
      readonly evidence_refs: readonly string[];
    }[];
  }[];
}

const issue41Case = JSON.parse(readFileSync(resolve(process.cwd(), "../../fixtures/test-cases/issue-41/semantic-topology.case.jsonc"), "utf8")) as Issue41TopologyCase;

function createIssue41Candidate(): FamJsonRecord {
  const fam = structuredClone(createLiteralDecompositionFam("仮1。仮2。仮3。仮4。", "q://test/playground/issue-41"));
  const mutableFam = fam as unknown as Record<string, unknown>;
  const lambda = mutableFam.λ as { output_units: Array<Record<string, unknown>>; purpose_expression: string };
  const units = issue41Case.units.map((sourceText, index) => {
    const template = structuredClone(lambda.output_units[index]!);
    const unitRef = `${fam.fam_id}/unit/${index + 1}`;
    template.ψ = { source_text: sourceText, source_ref: "input://issue-41/human-test", source_language: "ja", observation_status: "provided" };
    template["∇φ"] = [{ gradient_type: "source-segmentation", method: "human-observed-expectation", source_expression: sourceText, source_language: "ja", source_mutation: false }];
    template.λ = { manifestation: sourceText, manifestation_language: "ja", semantic_role: "unclassified-wisdom-unit", sub_splitters: [] };
    template.Q = {
      observer_ref: "observer://fquery/issue-41/user",
      registry_ref: "registry://fquery/fam-core",
      fact_scope_ref: "q://test/playground/issue-41",
      unit_index: index,
      unit_ref: unitRef,
      unit_revision_ref: `${unitRef}/revision/1`,
      parent_fam_ref: fam.fam_id,
      parent_revision_ref: fam.revision_id,
      unit_order: index,
      claim_kind: "unknown",
      classification_status: "unknown",
      unknowns: [],
      unknown_is_absence: false,
    };
    return template;
  });
  mutableFam.title = issue41Source;
  mutableFam.ψ = { source_text: issue41Source, source_ref: "input://issue-41/human-test", source_language: "ja", observation_status: "provided" };
  mutableFam["∇φ"] = [{ gradient_type: "decomposition", method: "human-observed-expectation", source_expression: issue41Source, source_language: "ja", source_mutation: false }];
  lambda.output_units = units;
  lambda.purpose_expression = issue41Source;
  const q = mutableFam.Q as Record<string, unknown>;
  q.semantic_topology_branches = issue41Case.branches.map((branch) => ({
    branch_ref: branch.branch_ref,
    observer_ref: branch.observer_ref,
    relations: branch.relations.map((relation) => ({
      from_unit_ref: (units[relation.from_unit_order]!.Q as { unit_ref: string }).unit_ref,
      to_unit_ref: (units[relation.to_unit_order]!.Q as { unit_ref: string }).unit_ref,
      axis: relation.axis,
      relation_kind: relation.relation_kind,
      evidence_refs: relation.evidence_refs,
    })),
  }));
  return fam;
}

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

  it("Issue #41実文の複数解釈を排他せずmL鎖またはnested Foldとして投影する", async () => {
    const factFam = createIssue41Candidate();
    const factUnits = (factFam.λ as { output_units: Array<{ Q: { unit_ref: string } }> }).output_units;
    expect((factFam.ψ as { source_text: string }).source_text).toBe(issue41Source);
    expect(factUnits.map((unit) => unit.Q.unit_ref)).toHaveLength(4);

    const factSession = createPlaygroundSession().session;
    const factIds = await buildCoreGraph(factSession);
    const factProjected = await projectDecompositionGraph(factSession, factIds, factFam, baseAccessMap);
    const factRoot = factSession.state.nodes.find((node) => node.nodeId === factProjected.famvim)!;
    expect(factRoot.foldBoundary).toMatchObject({
      childFoldRefs: factUnits.map((unit) => unit.Q.unit_ref),
      boundaryMetrics: { direct_child_count: 4, mL: { max: 3, median: 3, min: 3 } },
    });
    expect(factRoot.value).toMatchObject({
      semanticTopology: {
        status: "selected",
        selectedBranch: { branchRef: "branch://fquery/decomposition/primary" },
        branches: [
          { branchRef: "branch://fquery/decomposition/primary" },
          { branchRef: "branch://fquery/issue-41/astral-reading" },
        ],
      },
    });
    expect(factSession.state.connections.filter((connection) => connection.relationKind === "causal")).toHaveLength(3);

    const astralSession = createPlaygroundSession().session;
    const astralIds = await buildCoreGraph(astralSession);
    const astralAccessMap: AccessMapProfile = {
      ...baseAccessMap,
      semanticTopologyContract: {
        ...baseAccessMap.semanticTopologyContract!,
        selectedBranchRef: "branch://fquery/issue-41/astral-reading",
        selectionScopeRef: "scope://fquery/issue-41/human-observer/presentation-only",
      },
    };
    const astralProjected = await projectDecompositionGraph(astralSession, astralIds, createIssue41Candidate(), astralAccessMap);
    const astralRoot = astralSession.state.nodes.find((node) => node.nodeId === astralProjected.famvim)!;
    const astralByFold = new Map(astralSession.state.nodes.flatMap((node) => node.foldRef ? [[node.foldRef, node]] : []));
    const mergedBoundary = astralByFold.get(factUnits[2]!.Q.unit_ref)!;
    const nestedMemory = astralByFold.get(factUnits[3]!.Q.unit_ref)!;
    expect(astralRoot.foldBoundary).toMatchObject({
      childFoldRefs: [factUnits[0]!.Q.unit_ref, factUnits[1]!.Q.unit_ref, factUnits[2]!.Q.unit_ref],
      boundaryMetrics: { direct_child_count: 3, mL: { max: 3, median: 3, min: 3 } },
    });
    expect(mergedBoundary.foldBoundary).toMatchObject({ childFoldRefs: [factUnits[3]!.Q.unit_ref], boundaryMetrics: { G: { max: 1 } } });
    expect(nestedMemory.parentNodeId).toBe(mergedBoundary.nodeId);
    expect(mergedBoundary.ports.map((port) => port.label)).toEqual(["外Ψ", "内Ψ", "内λ", "外λ"]);
    expect(astralSession.state.connections.some((connection) => connection.fromPortId === `${astralRoot.nodeId}:children` && connection.toPortId === `${nestedMemory.nodeId}:psi`)).toBe(false);
  });
});
