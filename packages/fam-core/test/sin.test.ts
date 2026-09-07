import { describe, expect, it } from "vitest";
import { propagateLocalSin, validateLocalSinMeasurement, type LocalSinMeasurement } from "../src/index.js";

const measured: LocalSinMeasurement = {
  measurementId: "sin://test/node-a",
  nodeRef: "fam://test#node-a",
  targetRef: "vector://target/a",
  observedRef: "vector://observed/a",
  source: "fixture",
  status: "measured",
  value: 2.4,
  metricRef: "metric://fixture/angular-divergence",
  scaleRef: "scale://fixture/0-3",
  ambiguityRefs: ["ambiguity://sin-theta-reflection"],
};

describe("local sin / parent SIN propagation", () => {
  it("metricとscaleを持つ局所観測を注入aggregatorへ渡す", () => {
    const receipt = propagateLocalSin("fam://test#parent", [measured], {
      ruleRef: "rule://test/propagation",
      measureRuleRef: "metric://fixture/angular-divergence",
      sectorRuleRef: "sector://candidate/0-3",
      gain: 0.5,
      criticality: "observe",
    }, (contributions) => ({ value: contributions.reduce((sum, item) => sum + item.weightedValue, 0), metricRef: "metric://fixture/weighted-sum" }));
    expect(receipt).toMatchObject({ status: "measured", aggregateValue: 1.2, stopRequested: false, interpretation: "profile-scoped-observation" });
    expect(receipt.contributions[0]).toMatchObject({ measuredValue: 2.4, gain: 0.5, weightedValue: 1.2 });
  });

  it("高い値やstop-candidateを自動停止へ昇格しない", () => {
    const receipt = propagateLocalSin("fam://test#parent", [{ ...measured, value: 99 }], {
      ruleRef: "rule://test/high",
      measureRuleRef: "metric://fixture/custom",
      gain: 1,
      criticality: "stop-candidate",
      stopConditionRef: "condition://human-review",
    }, (items) => ({ value: items[0]!.weightedValue, metricRef: "metric://fixture/passthrough" }));
    expect(receipt).toMatchObject({ status: "measured", aggregateValue: 99, stopRequested: false });
  });

  it("vector store値にはcalibration参照を要求する", () => {
    expect(validateLocalSinMeasurement({ ...measured, source: "vector-store", calibrationRef: undefined })).toContain("vector-store-calibration-required");
    expect(validateLocalSinMeasurement({ ...measured, source: "vector-store", calibrationRef: "calibration://ibd/store-a@1" })).toEqual([]);
  });

  it("未測定nodeを0へ変換せずparentをunresolvedにする", () => {
    const receipt = propagateLocalSin("fam://test#parent", [{ ...measured, status: "unresolved", value: undefined, metricRef: undefined, scaleRef: undefined }], {
      ruleRef: "rule://test/unresolved",
      measureRuleRef: "metric://fixture/custom",
      gain: 1,
      criticality: "preserve",
    }, () => ({ value: 0, metricRef: "metric://fixture/unused" }));
    expect(receipt).toMatchObject({ status: "unresolved", stopRequested: false });
    expect(receipt.unresolvedMeasurementIds).toEqual(["sin://test/node-a"]);
    expect(receipt).not.toHaveProperty("aggregateValue");
  });
});
