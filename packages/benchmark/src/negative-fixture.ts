import type { StatusAxes } from "@fquery/core";
import { normalizeLegacyFailureMode, type FamFailureClass } from "@fquery/famlog";

export interface NegativeFixture {
  readonly schema_version: "fquery.negative-fixture/0.1.0-draft";
  readonly case_id: string;
  readonly world_ref: string;
  readonly goal_lambda: string;
  readonly target_ref: string;
  readonly target_ontology: readonly string[];
  readonly candidate_capability: string;
  readonly capability_world: string;
  readonly capability_effect: string;
  readonly resource_constraints: readonly string[];
  readonly expected_status: Readonly<Partial<StatusAxes>>;
  readonly expected_failure_class: FamFailureClass;
  readonly expected_fallback: string | null;
  readonly expected_famlog_events: readonly string[];
  readonly provenance: Readonly<Record<string, unknown>>;
}

export interface NegativeFixtureObservation {
  readonly status: Readonly<Partial<StatusAxes>>;
  readonly failureClasses: readonly FamFailureClass[];
  readonly famlogEvents: readonly string[];
  readonly fallback: string | null;
}

export interface NegativeFixtureAssessment {
  readonly passed: boolean;
  readonly findings: readonly string[];
}

export function validateNegativeFixture(value: unknown): readonly string[] {
  const findings: string[] = [];
  if (!isRecord(value)) return Object.freeze(["$:record-required"]);
  if (value.schema_version !== "fquery.negative-fixture/0.1.0-draft") findings.push("$.schema_version:unsupported");
  for (const field of ["case_id", "world_ref", "goal_lambda", "target_ref", "candidate_capability", "capability_world", "capability_effect"] as const) {
    if (typeof value[field] !== "string" || value[field].length === 0) findings.push(`$.${field}:string-required`);
  }
  for (const field of ["target_ontology", "resource_constraints", "expected_famlog_events"] as const) {
    if (!Array.isArray(value[field]) || value[field].some((entry) => typeof entry !== "string")) findings.push(`$.${field}:string-array-required`);
  }
  if (!isRecord(value.expected_status)) findings.push("$.expected_status:record-required");
  if (typeof value.expected_failure_class !== "string") findings.push("$.expected_failure_class:string-required");
  else if (normalizeLegacyFailureMode(value.expected_failure_class) !== value.expected_failure_class) findings.push("$.expected_failure_class:unknown");
  if (value.expected_fallback !== null && typeof value.expected_fallback !== "string") findings.push("$.expected_fallback:string-or-null-required");
  if (!isRecord(value.provenance)) findings.push("$.provenance:record-required");
  return Object.freeze(findings);
}

export function assessNegativeFixture(fixture: NegativeFixture, observation: NegativeFixtureObservation): NegativeFixtureAssessment {
  const findings = [...validateNegativeFixture(fixture)];
  for (const [axis, expected] of Object.entries(fixture.expected_status)) {
    const actual = observation.status[axis as keyof StatusAxes];
    if (actual !== expected) findings.push(`status:${axis}:expected=${String(expected)}:actual=${String(actual)}`);
  }
  if (!observation.failureClasses.includes(fixture.expected_failure_class)) findings.push(`failure-class-missing:${fixture.expected_failure_class}`);
  for (const event of fixture.expected_famlog_events) if (!observation.famlogEvents.includes(event)) findings.push(`famlog-event-missing:${event}`);
  if (observation.fallback !== fixture.expected_fallback) findings.push(`fallback:expected=${String(fixture.expected_fallback)}:actual=${String(observation.fallback)}`);
  return Object.freeze({ passed: findings.length === 0, findings: Object.freeze(findings) });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
