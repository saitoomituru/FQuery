import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyWithAccessMap, createLiteralDecompositionFam, projectSemanticTopology, readAccessMapProfile, readFamJson } from "../src/index.js";

const fixtureUrl = new URL("../../../fixtures/test-cases/basic-commons-access-mapper/access-map.fam.json", import.meta.url);

describe("Basic Commons Access Mapper FAM", () => {
  const document = readFamJson(readFileSync(fixtureUrl, "utf8"));
  const profile = readAccessMapProfile(document.value);

  it("FAM identityとrevisionを保持した注入profileとして読める", () => {
    expect(profile).toMatchObject({
      famId: "fam://fquery/test/basic-commons-access-mapper",
      revisionId: "rev://fquery/test/basic-commons-access-mapper/2",
      unknownPolicy: "retain",
      unmappedPolicy: "retain-unmapped",
    });
    expect(profile.factExtractors[0]).toMatchObject({ sourceUnitOrder: 0, factKey: "precipitationProbability", valueType: "number" });
    expect(profile.causalGates[0]).toMatchObject({ threshold: 38, activeUnitOrders: [1, 2], fallbackUnitOrders: [] });
    expect(profile.semanticTopologyContract).toMatchObject({ branchesPointer: "/Q/semantic_topology_branches", selectedBranchRef: "branch://fquery/decomposition/primary", selectionScopeRef: "scope://fquery/playground/presentation-only" });
  });

  it("Astral factをactor/action-local scopeへ明示写像する", () => {
    expect(classifyWithAccessMap(profile, "astral-fact")).toMatchObject({
      status: "mapped",
      dimensionRef: "dimension://fquery/test/astral",
      evidenceScope: ["actor-local", "action-local", "not-world-global"],
    });
  });

  it("未知claim kindを推測分類せずunmappedとして保持する", () => {
    expect(classifyWithAccessMap(profile, "theology-local")).toMatchObject({
      status: "unmapped",
      evidenceScope: ["unknown", "not-absence"],
    });
  });

  it("profile指定pathとfield名から複数topology branchを読み一つだけpresentation選択する", () => {
    const fam = structuredClone(createLiteralDecompositionFam("前提A。前提B。判断。結論。", "q://test/topology"));
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
    const mapped = {
      ...profile,
      semanticTopologyContract: {
        branchesPointer: "/Q/provider_graphs",
        selectedBranchRef: "branch://fact-domain",
        selectionScopeRef: "scope://test/presentation-only",
        fields: { branchRef: "id", observerRef: "by", relations: "links", fromUnitRef: "from", toUnitRef: "to", axis: "chain_axis", relationKind: "kind", evidenceRefs: "receipts" },
      },
    } as const;
    const topology = projectSemanticTopology(fam, mapped);
    expect(topology).toMatchObject({ status: "selected", selectionScopeRef: "scope://test/presentation-only", selectedBranch: { branchRef: "branch://fact-domain", observerRef: "observer://human/fact-reading" } });
    expect(topology.branches).toHaveLength(2);
    expect(topology.selectedBranch?.relations).toHaveLength(3);
    expect(topology.branches[1]?.branchRef).toBe("branch://astral-reading");
  });

  it("topology未宣言をunit順の暗黙chainへ変換しない", () => {
    expect(projectSemanticTopology(createLiteralDecompositionFam("A。B。", "q://test/no-topology"), profile)).toEqual({
      status: "topology-not-declared",
      branches: [],
      selectionScopeRef: "scope://fquery/playground/presentation-only",
    });
  });

  it("一つのunitを複数Foldへ同時containmentする候補をprofile不適合として拒否する", () => {
    const fam = structuredClone(createLiteralDecompositionFam("A。B。C。", "q://test/multiple-containment"));
    const units = (fam.λ as { output_units: Array<{ Q: { unit_ref: string } }> }).output_units;
    (fam.Q as Record<string, unknown>).semantic_topology_branches = [{
      branch_ref: "branch://fquery/decomposition/primary",
      observer_ref: "observer://test",
      relations: [
        { from_unit_ref: units[0]!.Q.unit_ref, to_unit_ref: units[2]!.Q.unit_ref, axis: "mL", relation_kind: "parent-child", evidence_refs: [] },
        { from_unit_ref: units[1]!.Q.unit_ref, to_unit_ref: units[2]!.Q.unit_ref, axis: "mL", relation_kind: "parent-child", evidence_refs: [] },
      ],
    }];
    expect(() => projectSemanticTopology(fam, profile)).toThrow("semantic-topology-multiple-containment-parents");
  });
});
