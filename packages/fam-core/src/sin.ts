export type SinMeasurementStatus = "not-evaluated" | "measured" | "unresolved";
export type SinMeasurementSource = "semantic-probe" | "vector-store" | "human-review" | "fixture";

export interface LocalSinMeasurement {
  readonly measurementId: string;
  readonly nodeRef: string;
  readonly targetRef: string;
  readonly observedRef: string;
  readonly source: SinMeasurementSource;
  readonly status: SinMeasurementStatus;
  readonly value?: number;
  readonly metricRef?: string;
  readonly scaleRef?: string;
  readonly calibrationRef?: string;
  readonly ambiguityRefs: readonly string[];
}

export interface SinPropagationRule {
  readonly ruleRef: string;
  readonly measureRuleRef: string;
  readonly sectorRuleRef?: string;
  readonly gain: number;
  readonly criticality: "preserve" | "observe" | "review" | "stop-candidate";
  readonly stopConditionRef?: string;
}

export interface SinContribution {
  readonly measurementId: string;
  readonly nodeRef: string;
  readonly measuredValue: number;
  readonly gain: number;
  readonly weightedValue: number;
  readonly metricRef: string;
  readonly scaleRef: string;
}

export interface ParentSinPropagationReceipt {
  readonly schemaVersion: "fquery.sin-propagation/0.1.0-draft";
  readonly parentRef: string;
  readonly ruleRef: string;
  readonly status: "measured" | "unresolved";
  readonly aggregateValue?: number;
  readonly aggregateMetricRef?: string;
  readonly contributions: readonly SinContribution[];
  readonly unresolvedMeasurementIds: readonly string[];
  readonly stopRequested: false;
  readonly interpretation: "profile-scoped-observation";
}

export type SinAggregator = (contributions: readonly SinContribution[]) => {
  readonly value: number;
  readonly metricRef: string;
};

export function validateLocalSinMeasurement(measurement: LocalSinMeasurement): readonly string[] {
  const issues: string[] = [];
  if (!measurement.measurementId) issues.push("measurement-id-required");
  if (!measurement.nodeRef) issues.push("node-ref-required");
  if (measurement.status === "measured") {
    if (typeof measurement.value !== "number" || !Number.isFinite(measurement.value)) issues.push("finite-value-required");
    if (!measurement.metricRef) issues.push("metric-ref-required");
    if (!measurement.scaleRef) issues.push("scale-ref-required");
    if (measurement.source === "vector-store" && !measurement.calibrationRef) issues.push("vector-store-calibration-required");
  } else if (measurement.value !== undefined) {
    issues.push("unmeasured-value-forbidden");
  }
  return Object.freeze(issues);
}

export function propagateLocalSin(
  parentRef: string,
  measurements: readonly LocalSinMeasurement[],
  rule: SinPropagationRule,
  aggregate: SinAggregator,
): ParentSinPropagationReceipt {
  if (!parentRef) throw new TypeError("parentRefは空にできません");
  if (!Number.isFinite(rule.gain)) throw new TypeError("gainは有限値でなければなりません");
  const invalid = measurements.flatMap((measurement) => validateLocalSinMeasurement(measurement).map((issue) => `${measurement.measurementId}:${issue}`));
  if (invalid.length > 0) throw new TypeError(`invalid-local-sin:${invalid.join(",")}`);
  const unresolvedMeasurementIds = measurements.filter((measurement) => measurement.status !== "measured").map((measurement) => measurement.measurementId);
  const contributions = measurements.flatMap((measurement): SinContribution[] => {
    if (measurement.status !== "measured" || measurement.value === undefined || !measurement.metricRef || !measurement.scaleRef) return [];
    return [Object.freeze({
      measurementId: measurement.measurementId,
      nodeRef: measurement.nodeRef,
      measuredValue: measurement.value,
      gain: rule.gain,
      weightedValue: measurement.value * rule.gain,
      metricRef: measurement.metricRef,
      scaleRef: measurement.scaleRef,
    })];
  });
  const base = {
    schemaVersion: "fquery.sin-propagation/0.1.0-draft" as const,
    parentRef,
    ruleRef: rule.ruleRef,
    contributions: Object.freeze(contributions),
    unresolvedMeasurementIds: Object.freeze(unresolvedMeasurementIds),
    stopRequested: false as const,
    interpretation: "profile-scoped-observation" as const,
  };
  if (unresolvedMeasurementIds.length > 0 || contributions.length === 0) return Object.freeze({ ...base, status: "unresolved" });
  const aggregated = aggregate(contributions);
  if (!Number.isFinite(aggregated.value) || !aggregated.metricRef) throw new TypeError("invalid-sin-aggregate");
  return Object.freeze({ ...base, status: "measured", aggregateValue: aggregated.value, aggregateMetricRef: aggregated.metricRef });
}
