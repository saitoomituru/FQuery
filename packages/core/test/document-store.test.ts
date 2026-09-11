import { describe, expect, it } from "vitest";
import {
  createFamModuleResolver,
  InMemoryFamDocumentStore,
  resolveFamModuleGraph,
  type FamTopologyModuleInput,
} from "../src/index.js";

function module(
  moduleRef: string,
  revisionRef: string,
  foldRef: string,
  childRef?: { readonly fam: string; readonly revision?: string },
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
          "∇φ": childRef ? { fam_ref: childRef.fam, ...(childRef.revision ? { revision_ref: childRef.revision } : {}) } : "leaf",
          λ: "this.parent",
          Q: {},
        },
      },
      λ: moduleRef,
      Q: {},
    },
  };
}

describe("FamDocumentStore / InMemoryFamDocumentStore", () => {
  it("put/get/has/listRevisionsが素直に動く", () => {
    const store = new InMemoryFamDocumentStore();
    store.put(module("fam://a", "rev-1", "fold://a"));
    store.put(module("fam://a", "rev-2", "fold://a"));

    expect(store.has("fam://a", "rev-1")).toBe(true);
    expect(store.has("fam://a", "rev-3")).toBe(false);
    expect(store.listRevisions("fam://a")).toEqual(["rev-1", "rev-2"]);
    expect(store.get("fam://a", "rev-1")?.revisionRef).toBe("rev-1");
    expect(store.get("fam://a", "rev-3")).toBeUndefined();
  });

  it("resolveはpinnedを既定候補としlatestを無条件採用しない", () => {
    const store = new InMemoryFamDocumentStore();
    store.put(module("fam://a", "rev-1", "fold://a"));
    store.put(module("fam://a", "rev-2", "fold://a"));

    const pinned = store.resolve("fam://a", { mode: "pinned", revisionRef: "rev-1" });
    expect(pinned).toMatchObject({ status: "resolved", revisionRef: "rev-1" });

    const latest = store.resolve("fam://a", { mode: "latest" });
    expect(latest).toMatchObject({ status: "resolved", revisionRef: "rev-2" });
  });

  it("mode指定なしはTypeErrorにする", () => {
    const store = new InMemoryFamDocumentStore();
    store.put(module("fam://a", "rev-1", "fold://a"));
    expect(() => store.resolve("fam://a", {} as never)).toThrow(TypeError);
  });

  it("未登録moduleRefとrevision不一致をUNKNOWN + Last Orderで返す", () => {
    const store = new InMemoryFamDocumentStore();
    store.put(module("fam://a", "rev-1", "fold://a"));

    const missingModule = store.resolve("fam://missing", { mode: "latest" });
    expect(missingModule.status).toBe("unknown");
    if (missingModule.status === "unknown") {
      expect(missingModule.lastOrder.schemaVersion).toBe("ibd.last-order/0.1.0-draft");
      expect(missingModule.lastOrder.reason.code).toBe("FAM-REF-NOT-FOUND");
    }

    const missingRevision = store.resolve("fam://a", { mode: "pinned", revisionRef: "rev-999" });
    expect(missingRevision.status).toBe("unknown");
    if (missingRevision.status === "unknown") {
      expect(missingRevision.lastOrder.reason.code).toBe("REVISION-NOT-FOUND");
    }
  });

  it("createFamModuleResolverでresolveFamModuleGraphへ接続し、cross-FAM循環をinline展開しない", async () => {
    const store = new InMemoryFamDocumentStore();
    const parent = module("fam://parent", "rev-1", "fold://parent", { fam: "fam://child" });
    const child = module("fam://child", "rev-1", "fold://child", { fam: "fam://parent" });
    store.put(parent);
    store.put(child);

    const resolver = createFamModuleResolver(store);
    const graph = await resolveFamModuleGraph(parent, resolver);

    expect(graph.inlineExpansion).toBe(false);
    expect(graph.modules.map((entry) => entry.moduleRef)).toEqual(["fam://parent", "fam://child"]);
    expect(graph.references.map((entry) => entry.status)).toEqual(["resolved", "cycle"]);
  });

  it("targetRevisionRef省略時はunpinnedRevisionPolicyで明示的に上書きできる", async () => {
    const store = new InMemoryFamDocumentStore();
    const parent = module("fam://parent", "rev-1", "fold://parent", { fam: "fam://child" });
    store.put(parent);
    store.put(module("fam://child", "rev-old", "fold://child"));
    store.put(module("fam://child", "rev-new", "fold://child"));

    const pinnedToOld = createFamModuleResolver(store, {
      unpinnedRevisionPolicy: () => ({ mode: "pinned", revisionRef: "rev-old" }),
    });
    const graph = await resolveFamModuleGraph(parent, pinnedToOld);
    expect(graph.modules[1]).toMatchObject({ moduleRef: "fam://child", revisionRef: "rev-old" });
  });

  it("未解決参照はresolveFamModuleGraph側でunresolvedとして保持される", async () => {
    const store = new InMemoryFamDocumentStore();
    const parent = module("fam://parent", "rev-1", "fold://parent", { fam: "fam://missing" });
    store.put(parent);

    const resolver = createFamModuleResolver(store);
    const graph = await resolveFamModuleGraph(parent, resolver);
    expect(graph.references[0]).toMatchObject({ status: "unresolved", requestedFamRef: "fam://missing" });
    expect(graph.issues[0]).toMatchObject({ code: "module-unresolved" });
  });
});
