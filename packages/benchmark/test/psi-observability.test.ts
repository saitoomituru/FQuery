import { describe, expect, it } from "vitest";
import { classifyEffectiveOneLiner, observePsiInterfaces, type PsiProbeObservation } from "../src/index.js";

const observations: readonly PsiProbeObservation[] = [
  { probeId: "probe://a", interfaceRef: "psi://question", responseClass: "nontrivial", routeRef: "route://a", lambdaCoherent: true, qCoherent: true, transferSurvived: true },
  { probeId: "probe://b", interfaceRef: "psi://counterexample", responseClass: "nontrivial", routeRef: "route://b", lambdaCoherent: true, qCoherent: "unknown", transferSurvived: true },
  { probeId: "probe://c", interfaceRef: "psi://unknown-world", responseClass: "zero", lambdaCoherent: "unknown", qCoherent: "unknown", transferSurvived: "unknown" },
];

describe("ψ interface observability", () => {
  it("文字数を使わずprobe応答とdistinct routeを観測する", () => {
    const report = observePsiInterfaces("fam://test/wisdom", "registry://test/probes@1", observations);
    expect(report).toMatchObject({ psiInterfaceCount: 3, zeroResponseCount: 1, nontrivialRouteCount: 2, zeroResponseRatio: 1 / 3, transferSurvivalCount: 2, truthValue: "not-asserted" });
    expect(report.distinctRouteRefs).toEqual(["route://a", "route://b"]);
    expect(report).not.toHaveProperty("effectiveRank");
  });

  it("effective rankはmetricとscaleを持つ注入推定だけを記録する", () => {
    const report = observePsiInterfaces("fam://test/wisdom", "registry://test/probes@1", observations, (items) => ({ value: new Set(items.flatMap((item) => item.routeRef ? [item.routeRef] : [])).size, metricRef: "metric://fixture/distinct-route-count", scaleRef: "scale://fixture/nonnegative-integer" }));
    expect(report).toMatchObject({ effectiveRank: 2, effectiveRankMetricRef: "metric://fixture/distinct-route-count", effectiveRankScaleRef: "scale://fixture/nonnegative-integer" });
  });

  it("one-liner判定をCore固定閾値にせずclassifierへ委譲する", () => {
    const report = observePsiInterfaces("fam://test/wisdom", "registry://test/probes@1", observations);
    expect(classifyEffectiveOneLiner(report, (value) => value.nontrivialRouteCount > 1 ? "candidate-multidimensional" : "candidate-effective-one-liner")).toBe("candidate-multidimensional");
  });

  it("未観測probe集合からrankを捏造しない", () => {
    expect(() => observePsiInterfaces("fam://test/wisdom", "registry://test/probes@1", [])).toThrow("1件以上");
  });
});
