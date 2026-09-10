import { describe, expect, it } from "vitest";
import { assessFamExtraction, normalizeFamTopology, resolveFamModuleGraph, type FamTopologyModuleInput } from "../src/index.js";

function module(
  moduleRef: string,
  revisionRef: string,
  foldRef: string,
  childRef?: { readonly fam: string; readonly revision: string },
): FamTopologyModuleInput {
  return {
    moduleRef,
    revisionRef,
    foldRef,
    value: {
      ψ: moduleRef,
      "∇φ": {
        unit: {
          ψ: "this.parent",
          "∇φ": childRef ? { fam_ref: childRef.fam, revision_ref: childRef.revision } : "leaf",
          λ: "this.parent",
          Q: {},
        },
      },
      λ: moduleRef,
      Q: {},
    },
  };
}

describe("FAM module graph / extraction boundary", () => {
  it("cross-FAMを明示referenceで解決しcycleをinline展開しない", async () => {
    const parent = module("fam://parent", "revision://parent/1", "fold://parent", { fam: "fam://child", revision: "revision://child/1" });
    const child = module("fam://child", "revision://child/1", "fold://child", { fam: "fam://parent", revision: "revision://parent/1" });
    const byRef = new Map([["fam://parent", parent], ["fam://child", child]]);

    const graph = await resolveFamModuleGraph(parent, (reference) => byRef.get(reference.targetFamRef));

    expect(graph.inlineExpansion).toBe(false);
    expect(graph.modules.map((entry) => [entry.moduleRef, entry.foldRef])).toEqual([
      ["fam://parent", "fold://parent"],
      ["fam://child", "fold://child"],
    ]);
    expect(graph.references.map((entry) => entry.status)).toEqual(["resolved", "cycle"]);
    expect(graph.references[1]).toMatchObject({ requestedFamRef: "fam://parent", resolvedModuleRef: "fam://parent" });
    expect(graph.issues).toEqual([]);
    expect(graph.modules[0]!.nodes.every((node) => node.owningFoldRef === "fold://parent")).toBe(true);
    expect(graph.modules[1]!.nodes.every((node) => node.owningFoldRef === "fold://child")).toBe(true);
  });

  it("未解決moduleとpinned revision不一致を別statusで保持する", async () => {
    const missing = module("fam://root/missing", "revision://root/1", "fold://root", { fam: "fam://missing", revision: "revision://missing/1" });
    const mismatch = module("fam://root/mismatch", "revision://root/1", "fold://root", { fam: "fam://child", revision: "revision://child/1" });
    const actualChild = module("fam://child", "revision://child/2", "fold://child");

    const unresolvedGraph = await resolveFamModuleGraph(missing, () => undefined);
    expect(unresolvedGraph.references[0]).toMatchObject({ status: "unresolved", requestedFamRef: "fam://missing" });
    expect(unresolvedGraph.issues[0]).toMatchObject({ code: "module-unresolved" });

    const mismatchGraph = await resolveFamModuleGraph(mismatch, () => actualChild);
    expect(mismatchGraph.references[0]).toMatchObject({
      status: "revision-mismatch",
      requestedRevisionRef: "revision://child/1",
      resolvedRevisionRef: "revision://child/2",
    });
    expect(mismatchGraph.modules).toHaveLength(1);
    expect(mismatchGraph.issues[0]).toMatchObject({ code: "module-revision-mismatch" });
  });

  it("共有・cross-Fold・独立revision・lossless不能をFAM extraction候補へ送る", () => {
    const topology = normalizeFamTopology(module("fam://parent", "revision://parent/1", "fold://parent"));
    const node = topology.nodes.find((candidate) => candidate.addressKey === "unit")!;

    expect(assessFamExtraction({ topology, nodeRef: node.nodeRef })).toMatchObject({
      status: "retain-local",
      semanticClassification: "not-evaluated",
      reasons: [],
    });
    expect(assessFamExtraction({
      topology,
      nodeRef: node.nodeRef,
      semanticConsumerRefs: ["consumer://a", "consumer://b"],
      targetFoldRefs: ["fold://parent", "fold://other"],
      independentRevisionRequired: true,
      sharedOrCircularIdentity: true,
      losslessLocalNormalization: false,
    })).toMatchObject({
      status: "extraction-candidate",
      sourceModuleRef: "fam://parent",
      sourceRevisionRef: "revision://parent/1",
      sourceFoldRef: "fold://parent",
      reasons: [
        "multiple-semantic-consumers",
        "cross-fold-portability",
        "independent-revision-required",
        "shared-or-circular-identity",
        "lossless-local-normalization-unavailable",
      ],
      semanticClassification: "not-evaluated",
    });
  });
});
