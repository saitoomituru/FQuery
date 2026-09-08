import { describe, expect, it } from "vitest";
import { declareFoldBoundaryContinuation, deriveFoldBoundaryMetrics, foldBoundaryLastOrder } from "../src/index.js";

describe("Fold boundary D/G/L/S", () => {
  it("D=context dimension、L=tool chain、mL=context chainを別namespaceで測る", () => {
    expect(deriveFoldBoundaryMetrics({ directChildNodeRefs: ["a", "b", "c", "d"], contextDimensionRefs: ["dimension://world", "dimension://astral", "dimension://astral"], nestingPathDepths: [1, 2, 4, 5], technologyNodeRefs: ["api", "adapter", "tool"], technologyChainEdges: [{ fromNodeRef: "api", toNodeRef: "adapter" }, { fromNodeRef: "adapter", toNodeRef: "tool" }], requiredTechnologyRoutes: [{ routeRef: "route://runner", entryNodeRef: "api", exitNodeRef: "tool" }], metaContextNodeRefs: ["a", "b", "c", "d"], metaContextChainEdges: [{ fromNodeRef: "a", toNodeRef: "b" }, { fromNodeRef: "b", toNodeRef: "c" }, { fromNodeRef: "a", toNodeRef: "d" }], nodePluginAvailable: true, exitAdapterRef: "adapter://lambda" })).toEqual({ G: { max: 5, median: 3, min: 1 }, D: 2, L: { max: 3, median: 3, min: 3, continuity: "connected", broken_route_refs: [] }, mL: { max: 3, median: 2.5, min: 2 }, direct_child_count: 4, S: { socket_present: true, adapter_ref: "adapter://lambda", on_missing: "last-order" } });
  });
  it("adapter不在を代替生成で埋めずLast Order契約に固定する", () => {
    const metrics = deriveFoldBoundaryMetrics({ directChildNodeRefs: [], contextDimensionRefs: [], nestingPathDepths: [], technologyNodeRefs: [], technologyChainEdges: [], requiredTechnologyRoutes: [], metaContextNodeRefs: [], metaContextChainEdges: [], nodePluginAvailable: true, exitAdapterRef: null });
    expect(metrics).toEqual({ G: { max: 0, median: 0, min: 0 }, D: 0, L: { max: 0, median: 0, min: 0, continuity: "not-declared", broken_route_refs: [] }, mL: { max: 0, median: 0, min: 0 }, direct_child_count: 0, S: { socket_present: false, adapter_ref: null, on_missing: "last-order" } });
    expect(foldBoundaryLastOrder(metrics)).toMatchObject({ code: "FOLD-SOCKET-MISSING", resumeWhen: "socket-present" });
  });
  it("mLが連続していても必須tool route切断を補完せずLast Orderへ送る", () => {
    const metrics = deriveFoldBoundaryMetrics({ directChildNodeRefs: ["judgement-a", "judgement-b"], contextDimensionRefs: ["dimension://decision"], nestingPathDepths: [1], technologyNodeRefs: ["api", "adapter", "tool"], technologyChainEdges: [{ fromNodeRef: "api", toNodeRef: "adapter" }], requiredTechnologyRoutes: [{ routeRef: "route://required-api-to-tool", entryNodeRef: "api", exitNodeRef: "tool" }], metaContextNodeRefs: ["judgement-a", "judgement-b"], metaContextChainEdges: [{ fromNodeRef: "judgement-a", toNodeRef: "judgement-b" }], nodePluginAvailable: true, exitAdapterRef: "adapter://lambda" });
    expect(metrics.L).toMatchObject({ continuity: "disconnected", broken_route_refs: ["route://required-api-to-tool"] });
    expect(metrics.mL).toEqual({ max: 2, median: 2, min: 2 });
    expect(foldBoundaryLastOrder(metrics)).toMatchObject({ code: "FOLD-TOOL-CHAIN-DISCONNECTED", resumeWhen: "all-required-tool-routes-connected" });
    expect(declareFoldBoundaryContinuation(metrics, { mode: "spiritual-trust", domainRef: "domain://spiritual/user-trust", claimantRef: "observer://user", verificationStatus: "verification-prohibited", verificationBoundaryRef: "boundary://red-hat" })).toEqual({ mode: "spiritual-trust", domain_ref: "domain://spiritual/user-trust", claimant_ref: "observer://user", claim_status: "declared-belief", verification_status: "verification-prohibited", verification_boundary_ref: "boundary://red-hat", source_tool_chain_continuity: "disconnected", relabels_tool_chain_as_connected: false });
  });
  it("cycleを閉じた処理連鎖として偽装しない", () => {
    expect(() => deriveFoldBoundaryMetrics({ directChildNodeRefs: ["a", "b"], contextDimensionRefs: [], nestingPathDepths: [1], technologyNodeRefs: [], technologyChainEdges: [], requiredTechnologyRoutes: [], metaContextNodeRefs: ["a", "b"], metaContextChainEdges: [{ fromNodeRef: "a", toNodeRef: "b" }, { fromNodeRef: "b", toNodeRef: "a" }], nodePluginAvailable: true, exitAdapterRef: "adapter://lambda" })).toThrow("fold-meta-context-cycle");
  });
});
