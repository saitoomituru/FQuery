import { describe, expect, it } from "vitest";
import { reprojectFoldGraph, type FoldConditionGate, type FoldProjectionNode } from "../src/index.js";

const activeNodes: readonly FoldProjectionNode[] = [
  { foldRef: "fold://rain", order: 0, manifestation: "降水確率は38%である。", facts: { precipitationProbability: 38 } },
  { foldRef: "fold://anxiety", order: 1, manifestation: "不安である。", branch: { gateRef: "gate://rain-anxiety", role: "active" } },
  { foldRef: "fold://umbrella", order: 2, manifestation: "傘を持って出かける。", branch: { gateRef: "gate://rain-anxiety", role: "active" } },
];

const flatGate: FoldConditionGate = {
  gateRef: "gate://rain-anxiety",
  sourceFoldRef: "fold://rain",
  condition: { kind: "number-gte", path: ["precipitationProbability"], threshold: 38 },
  activeFoldRefs: ["fold://anxiety", "fold://umbrella"],
  fallbackFoldRefs: [],
  conditionScopeRef: "scope://fixture/author-defined-38",
};

describe("Fold causal reprojection", () => {
  it("38→68では局所条件を維持しλを順序どおり再投影する", () => {
    const nodes = activeNodes.map((node) => node.foldRef === "fold://rain" ? { ...node, manifestation: "降水確率は68%である。", facts: { precipitationProbability: 68 } } : node);
    const result = reprojectFoldGraph({ nodes, gates: [flatGate], dependencies: [], changedFoldRefs: ["fold://rain"] });
    expect(result).toMatchObject({ projectionStatus: "fresh", stale: false, manifestations: ["降水確率は68%である。", "不安である。", "傘を持って出かける。"] });
    expect(result.edgeEvaluations[0]).toMatchObject({ status: "retained", selectedRole: "active", recompositionRequired: false });
  });

  it("38→0のflat graphはfallbackを発明せず再構成待ちにする", () => {
    const nodes = activeNodes.map((node) => node.foldRef === "fold://rain" ? { ...node, manifestation: "降水確率は0%である。", facts: { precipitationProbability: 0 } } : node);
    const result = reprojectFoldGraph({ nodes, gates: [flatGate], dependencies: [], changedFoldRefs: ["fold://rain"] });
    expect(result).toMatchObject({ projectionStatus: "needs-recomposition", stale: true, manifestations: [], cancelledGateRefs: ["gate://rain-anxiety"] });
    expect(result.edgeEvaluations[0]).toMatchObject({ status: "cancelled", selectedFoldRefs: [], recompositionRequired: true });
  });

  it("explicit fallbackがあればbranch switchとして正常再投影する", () => {
    const nodes: readonly FoldProjectionNode[] = [
      { foldRef: "fold://rain", order: 0, manifestation: "降水確率は0%である。", facts: { precipitationProbability: 0 } },
      ...activeNodes.slice(1),
      { foldRef: "fold://calm", order: 1, manifestation: "不安は成立していない。", branch: { gateRef: "gate://rain-anxiety", role: "fallback" } },
      { foldRef: "fold://no-umbrella", order: 2, manifestation: "傘は持っていかなかった。", branch: { gateRef: "gate://rain-anxiety", role: "fallback" } },
    ];
    const gate = { ...flatGate, fallbackFoldRefs: ["fold://calm", "fold://no-umbrella"] };
    const result = reprojectFoldGraph({ nodes, gates: [gate], dependencies: [], changedFoldRefs: ["fold://rain"] });
    expect(result).toMatchObject({
      projectionStatus: "fresh",
      stale: false,
      manifestations: ["降水確率は0%である。", "不安は成立していない。", "傘は持っていかなかった。"],
      selectedFallbackRefs: ["fold://calm", "fold://no-umbrella"],
    });
  });

  it("変更Foldから到達するsubgraphだけを再検証対象にする", () => {
    const result = reprojectFoldGraph({
      nodes: [...activeNodes, { foldRef: "fold://unrelated", order: 3, manifestation: "無関係。" }],
      gates: [flatGate],
      dependencies: [{ edgeRef: "edge://anxiety-umbrella", fromFoldRef: "fold://anxiety", toFoldRef: "fold://umbrella", relation: "causal" }],
      changedFoldRefs: ["fold://rain"],
    });
    expect(result.affectedFoldRefs).toEqual(["fold://rain", "fold://anxiety", "fold://umbrella"]);
  });

  it("条件値が取れないとunknownを保持しstale出力を返さない", () => {
    const result = reprojectFoldGraph({ nodes: activeNodes.map((node) => node.foldRef === "fold://rain" ? { ...node, facts: {} } : node), gates: [flatGate], dependencies: [], changedFoldRefs: ["fold://rain"] });
    expect(result).toMatchObject({ projectionStatus: "needs-recomposition", stale: true, manifestations: [] });
    expect(result.edgeEvaluations[0]?.status).toBe("unknown");
  });
});
