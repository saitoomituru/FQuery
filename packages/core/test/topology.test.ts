import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  normalizeFamTopology,
  parseFamSelector,
  resolveTopologySelector,
  validateTopologyLayerReferences,
} from "../src/index.js";

async function sample(name: string): Promise<unknown> {
  return JSON.parse(await readFile(new URL(`../../../sample/${name}`, import.meta.url), "utf8"));
}

describe("FAM selector / topology normalizer", () => {
  it("selfをmodule、thisをnodeとして別identityへ解決する", async () => {
    const topology = normalizeFamTopology({
      moduleRef: "fam://sample/1",
      revisionRef: "revision://sample/1/1",
      foldRef: "fold://sample/1",
      value: await sample("sample1.fam.json"),
    });
    const first = topology.nodes.find((node) => node.arrayIndex === 0)!;

    expect(resolveTopologySelector(topology, first.nodeRef, "self")).toEqual({
      status: "resolved",
      targetKind: "module",
      moduleRef: "fam://sample/1",
      revisionRef: "revision://sample/1/1",
      foldRef: "fold://sample/1",
    });
    expect(resolveTopologySelector(topology, first.nodeRef, "this")).toEqual({
      status: "resolved",
      targetKind: "node",
      nodeRefs: [first.nodeRef],
    });
    expect(first.nodeRef).not.toBe(topology.moduleRef);
  });

  it("sample1のarrayをparallel sibling collectionとして保持しmL順を自動生成しない", async () => {
    const topology = normalizeFamTopology({
      moduleRef: "fam://sample/1",
      revisionRef: "revision://sample/1/1",
      foldRef: "fold://sample/1",
      value: await sample("sample1.fam.json"),
    });
    const root = topology.nodes.find((node) => node.nodeRef === topology.rootNodeRef)!;
    const children = topology.nodes.filter((node) => node.parentNodeRef === root.nodeRef);

    expect(topology.issues).toEqual([]);
    expect(children).toHaveLength(3);
    expect(new Set(children.map((node) => node.parallelCollectionRef))).toEqual(new Set([`${root.nodeRef}/parallel/∇φ`]));
    expect(children.every((node) => node.containerKind === "array-item")).toBe(true);
    expect(topology.edges.filter((edge) => edge.kind === "runtime")).toEqual([]);
    expect(topology.edges.filter((edge) => edge.kind === "structural")).toEqual([]);
    expect(resolveTopologySelector(topology, children[1]!.nodeRef, "this.parent")).toEqual({
      status: "resolved",
      targetKind: "node",
      nodeRefs: [root.nodeRef],
    });
    expect(resolveTopologySelector(topology, children[1]!.nodeRef, "this.siblings")).toMatchObject({
      status: "resolved",
      targetKind: "nodes",
      nodeRefs: [children[0]!.nodeRef, children[2]!.nodeRef],
    });
    expect(resolveTopologySelector(topology, root.nodeRef, "this.children")).toEqual({
      status: "resolved",
      targetKind: "nodes",
      nodeRefs: children.map((node) => node.nodeRef),
    });
  });

  it("sample2のobject keyをaddressable unitとしてmL before/afterへ解決する", async () => {
    const topology = normalizeFamTopology({
      moduleRef: "fam://sample/2",
      revisionRef: "revision://sample/2/1",
      foldRef: "fold://sample/2",
      value: await sample("sample2.fam.json"),
    });
    const byAddress = new Map(topology.nodes.filter((node) => node.addressKey).map((node) => [node.addressKey, node]));
    const fact = byAddress.get("fact")!;
    const anxiety = byAddress.get("anxiety")!;
    const umbrella = byAddress.get("umbrella")!;
    const runtimeEdges = topology.edges.filter((edge) => edge.kind === "runtime");

    expect(topology.issues).toEqual([]);
    expect([...byAddress.keys()]).toEqual(["fact", "anxiety", "umbrella"]);
    expect(runtimeEdges.map((edge) => [edge.fromNodeRef, edge.toNodeRef])).toEqual([
      [fact.nodeRef, anxiety.nodeRef],
      [anxiety.nodeRef, umbrella.nodeRef],
    ]);
    expect(runtimeEdges.map((edge) => edge.layerRefs)).toEqual([["アストラル"], ["エレメンタル"]]);
    expect(topology.edges.filter((edge) => edge.kind === "structural")).toEqual([]);
    expect(resolveTopologySelector(topology, anxiety.nodeRef, "this.before")).toEqual({
      status: "resolved",
      targetKind: "node",
      nodeRefs: [fact.nodeRef],
    });
    expect(resolveTopologySelector(topology, fact.nodeRef, "this.after.アストラル")).toEqual({
      status: "resolved",
      targetKind: "node",
      nodeRefs: [anxiety.nodeRef],
    });
  });

  it("同じrevisionでLのprev/nextとmLのbefore/afterを別routeとして保持する", async () => {
    const topology = normalizeFamTopology({
      moduleRef: "fam://sample/3/main",
      revisionRef: "revision://sample/3/main/1",
      foldRef: "fold://sample/3/main",
      value: await sample("sample3-1.fam.json"),
    });
    const byAddress = new Map(topology.nodes.filter((node) => node.addressKey).map((node) => [node.addressKey, node]));
    const structural = topology.edges.filter((edge) => edge.kind === "structural");
    const runtime = topology.edges.filter((edge) => edge.kind === "runtime");

    expect(structural.map((edge) => [edge.fromNodeRef, edge.toNodeRef])).toEqual([
      [byAddress.get("開発部")!.nodeRef, byAddress.get("製造")!.nodeRef],
    ]);
    expect(runtime.map((edge) => [edge.fromNodeRef, edge.toNodeRef])).toEqual([
      [byAddress.get("製造")!.nodeRef, byAddress.get("法務部")!.nodeRef],
      [byAddress.get("法務部")!.nodeRef, byAddress.get("QA")!.nodeRef],
      [byAddress.get("QA")!.nodeRef, byAddress.get("開発部")!.nodeRef],
    ]);
    expect(topology.revisionRef).toBe("revision://sample/3/main/1");
    expect(topology.moduleReferences).toEqual([
      expect.objectContaining({
        sourceNodeRef: byAddress.get("製造")!.nodeRef,
        targetFamRef: "./sample3-2.fam.json",
      }),
    ]);
    expect(topology.nodes.some((node) => node.addressKey === "製造3課")).toBe(false);
  });

  it("layer分類とcurrent Foldでのpointer存在検証を分離する", async () => {
    const topology = normalizeFamTopology({
      moduleRef: "fam://sample/2",
      revisionRef: "revision://sample/2/1",
      foldRef: "fold://self",
      value: await sample("sample2.fam.json"),
    });

    expect(validateTopologyLayerReferences(topology, {
      foldRef: "fold://self",
      layerRefs: ["アストラル", "エレメンタル"],
    })).toEqual({ pointerStatus: "valid", classificationStatus: "not-evaluated", issues: [] });

    expect(validateTopologyLayerReferences(topology, {
      foldRef: "fold://self",
      layerRefs: ["アストラル"],
    })).toMatchObject({
      pointerStatus: "invalid",
      classificationStatus: "not-evaluated",
      issues: [expect.objectContaining({ code: "unresolved-layer-ref", detail: "エレメンタル" })],
    });

    expect(validateTopologyLayerReferences(topology, {
      foldRef: "fold://corporate",
      layerRefs: ["アストラル", "エレメンタル"],
    })).toMatchObject({
      pointerStatus: "invalid",
      classificationStatus: "not-evaluated",
      issues: [expect.objectContaining({ code: "layer-registry-fold-mismatch" })],
    });
  });

  it("別FAMは明示fam_refとして残しlocal selectorからinline探索しない", () => {
    const topology = normalizeFamTopology({
      moduleRef: "fam://parent",
      revisionRef: "revision://parent/1",
      foldRef: "fold://parent",
      value: {
        ψ: "parent",
        "∇φ": {
          local: { ψ: "this.parent", "∇φ": { fam_ref: "fam://child", revision_ref: "revision://child/7" }, λ: "local", Q: {} },
        },
        λ: "parent",
        Q: {},
      },
    });
    const local = topology.nodes.find((node) => node.addressKey === "local")!;

    expect(topology.moduleReferences).toEqual([
      expect.objectContaining({ sourceNodeRef: local.nodeRef, targetFamRef: "fam://child", targetRevisionRef: "revision://child/7" }),
    ]);
    expect(topology.nodes).toHaveLength(2);
    expect(resolveTopologySelector(topology, local.nodeRef, "this.next.child")).toEqual({
      status: "unresolved",
      reason: "selector-target-not-found-in-current-fold",
      nodeRefs: [],
    });
  });

  it("selector parserは未定義の意味commandをCore traversalへ昇格しない", () => {
    expect(parseFamSelector("self")).toEqual({ raw: "self", base: "self", qualifiers: [] });
    expect(parseFamSelector("this.after.エレメンタル")).toEqual({
      raw: "this.after.エレメンタル",
      base: "this",
      traversal: "after",
      qualifiers: ["エレメンタル"],
    });
    expect(parseFamSelector("this.アストラル")).toBeUndefined();
    expect(parseFamSelector("other.next")).toBeUndefined();
  });
});
