export type PsiResponseClass = "zero" | "trivial" | "nontrivial" | "unresolved";

export interface PsiProbeObservation {
  readonly probeId: string;
  readonly interfaceRef: string;
  readonly responseClass: PsiResponseClass;
  readonly routeRef?: string;
  readonly lambdaCoherent: boolean | "unknown";
  readonly qCoherent: boolean | "unknown";
  readonly transferSurvived: boolean | "unknown";
}

export interface PsiObservabilityReport {
  readonly schemaVersion: "fquery.psi-observability/0.1.0-draft";
  readonly famRef: string;
  readonly probeRegistryRef: string;
  readonly psiInterfaceCount: number;
  readonly zeroResponseCount: number;
  readonly trivialResponseCount: number;
  readonly nontrivialRouteCount: number;
  readonly unresolvedCount: number;
  readonly zeroResponseRatio: number;
  readonly transferSurvivalCount: number;
  readonly distinctRouteRefs: readonly string[];
  readonly effectiveRank?: number;
  readonly effectiveRankMetricRef?: string;
  readonly effectiveRankScaleRef?: string;
  readonly truthValue: "not-asserted";
}

export interface EffectiveRankEstimate {
  readonly value: number;
  readonly metricRef: string;
  readonly scaleRef: string;
}

export type EffectiveRankEstimator = (observations: readonly PsiProbeObservation[]) => EffectiveRankEstimate;
export type EffectiveOneLinerClassification = "candidate-effective-one-liner" | "candidate-multidimensional" | "unresolved";
export type EffectiveOneLinerClassifier = (report: PsiObservabilityReport) => EffectiveOneLinerClassification;

export function observePsiInterfaces(
  famRef: string,
  probeRegistryRef: string,
  observations: readonly PsiProbeObservation[],
  estimateRank?: EffectiveRankEstimator,
): PsiObservabilityReport {
  if (!famRef || !probeRegistryRef) throw new TypeError("famRefとprobeRegistryRefは必須です");
  if (observations.length === 0) throw new RangeError("psi observationには1件以上のprobeが必要です");
  const identities = new Set<string>();
  for (const observation of observations) {
    if (!observation.probeId || !observation.interfaceRef) throw new TypeError("probeIdとinterfaceRefは必須です");
    const identity = `${observation.probeId}\u0000${observation.interfaceRef}`;
    if (identities.has(identity)) throw new TypeError(`duplicate-psi-probe:${observation.probeId}:${observation.interfaceRef}`);
    identities.add(identity);
  }
  const zeroResponseCount = observations.filter((item) => item.responseClass === "zero").length;
  const trivialResponseCount = observations.filter((item) => item.responseClass === "trivial").length;
  const unresolvedCount = observations.filter((item) => item.responseClass === "unresolved").length;
  const distinctRouteRefs = Object.freeze([...new Set(observations.flatMap((item) => item.responseClass === "nontrivial" && item.routeRef ? [item.routeRef] : []))]);
  const rank = estimateRank?.(observations);
  if (rank && (!Number.isFinite(rank.value) || !rank.metricRef || !rank.scaleRef)) throw new TypeError("invalid-effective-rank-estimate");
  return Object.freeze({
    schemaVersion: "fquery.psi-observability/0.1.0-draft",
    famRef,
    probeRegistryRef,
    psiInterfaceCount: observations.length,
    zeroResponseCount,
    trivialResponseCount,
    nontrivialRouteCount: distinctRouteRefs.length,
    unresolvedCount,
    zeroResponseRatio: zeroResponseCount / observations.length,
    transferSurvivalCount: observations.filter((item) => item.transferSurvived === true).length,
    distinctRouteRefs,
    ...(rank ? { effectiveRank: rank.value, effectiveRankMetricRef: rank.metricRef, effectiveRankScaleRef: rank.scaleRef } : {}),
    truthValue: "not-asserted",
  });
}

export function classifyEffectiveOneLiner(
  report: PsiObservabilityReport,
  classifier: EffectiveOneLinerClassifier,
): EffectiveOneLinerClassification {
  return classifier(report);
}
