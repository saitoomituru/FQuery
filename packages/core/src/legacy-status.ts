import type { StatusAxes } from "./types.js";

export type LegacyQStatus =
  | "draft"
  | "validated_in_context"
  | "untested"
  | "transferred_unverified"
  | "failed"
  | "deprecated"
  | "requires_conversion_layer"
  | "out_of_scope"
  | "partial_compatible"
  | "patch_pending";

export interface LegacyStatusProjection {
  readonly legacyStatus: LegacyQStatus;
  readonly constraints: Readonly<Partial<StatusAxes>>;
  readonly unmappedAxes: readonly (keyof StatusAxes)[];
  readonly losses: readonly string[];
}

export interface LegacyStatusSummary {
  readonly candidates: readonly LegacyQStatus[];
  readonly exact: false;
  readonly losses: readonly string[];
}

const AXES = Object.freeze([
  "resolutionStatus",
  "connectionStatus",
  "transportStatus",
  "pluginStatus",
  "semanticStatus",
  "lambdaStatus",
  "controlStatus",
] satisfies readonly (keyof StatusAxes)[]);

const LEGACY_CONSTRAINTS: Readonly<Record<LegacyQStatus, Readonly<Partial<StatusAxes>>>> = Object.freeze({
  draft: Object.freeze({ controlStatus: "continue" }),
  validated_in_context: Object.freeze({ resolutionStatus: "resolved", semanticStatus: "satisfied" }),
  untested: Object.freeze({ semanticStatus: "not-evaluated", lambdaStatus: "not-evaluated" }),
  transferred_unverified: Object.freeze({ resolutionStatus: "resolved", semanticStatus: "unknown", lambdaStatus: "unknown" }),
  failed: Object.freeze({}),
  deprecated: Object.freeze({}),
  requires_conversion_layer: Object.freeze({ resolutionStatus: "unresolved" }),
  out_of_scope: Object.freeze({}),
  partial_compatible: Object.freeze({ semanticStatus: "unknown" }),
  patch_pending: Object.freeze({ controlStatus: "last-order" }),
});

/** 旧Q.statusから確実に読める制約だけを返し、未記録の軸を既定値で埋めない。 */
export function projectLegacyQStatus(status: LegacyQStatus): LegacyStatusProjection {
  const constraints = LEGACY_CONSTRAINTS[status];
  const mapped = new Set(Object.keys(constraints) as (keyof StatusAxes)[]);
  return Object.freeze({
    legacyStatus: status,
    constraints,
    unmappedAxes: Object.freeze(AXES.filter((axis) => !mapped.has(axis))),
    losses: Object.freeze([
      "legacy Q.statusは現行の直交status軸を全て表現しない",
      ...(status === "failed" ? ["失敗した軸と原因はlegacy statusだけでは判定不能"] : []),
      ...(status === "out_of_scope" ? ["scope外とbottom、禁止、未解決はlegacy statusだけでは区別不能"] : []),
    ]),
  });
}

/** 現行軸から候補となる旧表示を返す。正確な逆変換は存在しない。 */
export function summarizeAsLegacyQStatus(axes: StatusAxes): LegacyStatusSummary {
  const candidates: LegacyQStatus[] = [];
  if (axes.controlStatus === "continue") candidates.push("draft");
  if (axes.resolutionStatus === "resolved" && axes.semanticStatus === "satisfied") candidates.push("validated_in_context");
  if (axes.semanticStatus === "not-evaluated" && axes.lambdaStatus === "not-evaluated") candidates.push("untested");
  if (axes.resolutionStatus === "resolved" && axes.semanticStatus === "unknown" && axes.lambdaStatus === "unknown") candidates.push("transferred_unverified");
  if (axes.resolutionStatus === "unresolved") candidates.push("requires_conversion_layer");
  if (axes.semanticStatus === "unknown") candidates.push("partial_compatible");
  if (axes.controlStatus === "last-order") candidates.push("patch_pending");
  if (axes.transportStatus === "failed" || axes.semanticStatus === "semantic-unsatisfied" || axes.lambdaStatus === "unsatisfied" || axes.controlStatus === "bottom") candidates.push("failed");
  return Object.freeze({
    candidates: Object.freeze([...new Set(candidates)]),
    exact: false,
    losses: Object.freeze([
      "現行のresolution、connection、transport、plugin、semantic、lambda、control軸を旧一値へ圧縮する",
      "deprecatedとout_of_scopeは外部scopeまたはlifecycle情報なしでは導出しない",
    ]),
  });
}
