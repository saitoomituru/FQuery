import type { CoreEvent, QueryResult } from "@fquery/core";

export { deliverOaeRecord, FoldLog, FOLD_LOG_SCHEMA_VERSION, OAE_RECORD_PROFILE_VERSION } from "./fold-log.js";
export type * from "./fold-log.js";

export interface FamLogEntry extends CoreEvent {
  readonly eventId: string;
  readonly sequence: number;
  readonly observedAt: string;
}

export interface FamLogOptions {
  readonly clock?: () => Date;
  readonly idFactory?: (sequence: number) => string;
  readonly redactor?: (value: unknown) => unknown;
}

export class FamLog {
  readonly #entries: FamLogEntry[] = [];
  readonly #clock: () => Date;
  readonly #idFactory: (sequence: number) => string;
  readonly #redactor: (value: unknown) => unknown;

  constructor(options: FamLogOptions = {}) {
    this.#clock = options.clock ?? (() => new Date());
    this.#idFactory = options.idFactory ?? ((sequence) => `famlog://event/${sequence}`);
    this.#redactor = options.redactor ?? redactSecrets;
  }

  append(event: CoreEvent): FamLogEntry {
    const sequence = this.#entries.length + 1;
    const entry: FamLogEntry = Object.freeze({
      ...event,
      ...(event.detail ? { detail: this.#redactor(event.detail) as Readonly<Record<string, unknown>> } : {}),
      eventId: this.#idFactory(sequence),
      sequence,
      observedAt: this.#clock().toISOString(),
    });
    this.#entries.push(entry);
    return entry;
  }

  entries(): readonly FamLogEntry[] {
    return Object.freeze([...this.#entries]);
  }
}

const SECRET_KEY = /(?:authorization|cookie|password|private[_-]?key|secret|token)/i;

export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, SECRET_KEY.test(key) ? "[REDACTED]" : redactSecrets(nested)]));
}

export interface FamLogDifference {
  readonly sequence: number;
  readonly left?: Pick<FamLogEntry, "eventType" | "status">;
  readonly right?: Pick<FamLogEntry, "eventType" | "status">;
}

export function diffFamLogs(left: readonly FamLogEntry[], right: readonly FamLogEntry[]): readonly FamLogDifference[] {
  const length = Math.max(left.length, right.length);
  const differences: FamLogDifference[] = [];
  for (let index = 0; index < length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (a?.eventType !== b?.eventType || a?.status !== b?.status) {
      differences.push({
        sequence: index + 1,
        ...(a ? { left: { eventType: a.eventType, status: a.status } } : {}),
        ...(b ? { right: { eventType: b.eventType, status: b.status } } : {}),
      });
    }
  }
  return differences;
}

export type FailureFamily = "structure" | "semantic" | "world" | "resource" | "transport" | "governance" | "observability";

export type FamFailureClass =
  | "metaphor-collapse"
  | "operator-regression"
  | "lambda-blur"
  | "gradient-flattening"
  | "false-universalization"
  | "port-hallucination"
  | "no-bottom-return"
  | "projection-dimension-mismatch"
  | "unknown-passed-as-ok"
  | "sensor-mode-insufficient"
  | "world-mismatch"
  | "cross-world-symbol-leak"
  | "effect-goal-conflict"
  | "capability-direction-mismatch"
  | "target-ontology-mismatch"
  | "capability-resource-insufficient"
  | "surface-similarity-confusion"
  | "lexical-neighbor-substitution"
  | "semantic-neighbor-misbinding"
  | "responsibility-abstraction-inversion"
  | "safety-abstraction-overcollapse"
  | "governance-induced-semantic-blur"
  | "protective-detail-loss"
  | "institutional-overreach"
  | "unsupported-success-claim"
  | "plugin-resolution-failure"
  | "cross-runtime-divergence";

export type DivergenceClass = FamFailureClass;

export interface FailureDescriptor {
  readonly failureClass: FamFailureClass;
  readonly family: FailureFamily;
  readonly source: "fold-access-mapper" | "fquery-core" | "chikuwa-negative-fixture";
}

const FAILURE_FAMILIES: Readonly<Record<FamFailureClass, FailureDescriptor>> = Object.freeze({
  "metaphor-collapse": descriptor("metaphor-collapse", "semantic", "fold-access-mapper"),
  "operator-regression": descriptor("operator-regression", "structure", "fold-access-mapper"),
  "lambda-blur": descriptor("lambda-blur", "semantic", "fold-access-mapper"),
  "gradient-flattening": descriptor("gradient-flattening", "structure", "fold-access-mapper"),
  "false-universalization": descriptor("false-universalization", "semantic", "fold-access-mapper"),
  "port-hallucination": descriptor("port-hallucination", "transport", "fold-access-mapper"),
  "no-bottom-return": descriptor("no-bottom-return", "structure", "fold-access-mapper"),
  "projection-dimension-mismatch": descriptor("projection-dimension-mismatch", "structure", "fold-access-mapper"),
  "unknown-passed-as-ok": descriptor("unknown-passed-as-ok", "observability", "fold-access-mapper"),
  "sensor-mode-insufficient": descriptor("sensor-mode-insufficient", "observability", "fold-access-mapper"),
  "world-mismatch": descriptor("world-mismatch", "world", "chikuwa-negative-fixture"),
  "cross-world-symbol-leak": descriptor("cross-world-symbol-leak", "world", "chikuwa-negative-fixture"),
  "effect-goal-conflict": descriptor("effect-goal-conflict", "semantic", "chikuwa-negative-fixture"),
  "capability-direction-mismatch": descriptor("capability-direction-mismatch", "semantic", "chikuwa-negative-fixture"),
  "target-ontology-mismatch": descriptor("target-ontology-mismatch", "world", "chikuwa-negative-fixture"),
  "capability-resource-insufficient": descriptor("capability-resource-insufficient", "resource", "chikuwa-negative-fixture"),
  "surface-similarity-confusion": descriptor("surface-similarity-confusion", "semantic", "chikuwa-negative-fixture"),
  "lexical-neighbor-substitution": descriptor("lexical-neighbor-substitution", "semantic", "chikuwa-negative-fixture"),
  "semantic-neighbor-misbinding": descriptor("semantic-neighbor-misbinding", "semantic", "chikuwa-negative-fixture"),
  "responsibility-abstraction-inversion": descriptor("responsibility-abstraction-inversion", "governance", "chikuwa-negative-fixture"),
  "safety-abstraction-overcollapse": descriptor("safety-abstraction-overcollapse", "governance", "chikuwa-negative-fixture"),
  "governance-induced-semantic-blur": descriptor("governance-induced-semantic-blur", "governance", "chikuwa-negative-fixture"),
  "protective-detail-loss": descriptor("protective-detail-loss", "governance", "chikuwa-negative-fixture"),
  "institutional-overreach": descriptor("institutional-overreach", "governance", "chikuwa-negative-fixture"),
  "unsupported-success-claim": descriptor("unsupported-success-claim", "observability", "fquery-core"),
  "plugin-resolution-failure": descriptor("plugin-resolution-failure", "transport", "fquery-core"),
  "cross-runtime-divergence": descriptor("cross-runtime-divergence", "observability", "fquery-core"),
});

export function describeFailureClass(failureClass: FamFailureClass): FailureDescriptor {
  return FAILURE_FAMILIES[failureClass];
}

export function normalizeLegacyFailureMode(value: string): FamFailureClass | undefined {
  const normalized = value.replaceAll("_", "-");
  return normalized in FAILURE_FAMILIES ? normalized as FamFailureClass : undefined;
}

export function classifyResult(result: QueryResult): readonly DivergenceClass[] {
  const classes = new Set<DivergenceClass>();
  if (result.connectionStatus === "unconnected" && result.controlStatus === "bottom") classes.add("port-hallucination");
  if (result.transportStatus === "succeeded" && result.lambdaStatus === "satisfied" && result.evidenceRefs.length === 0) classes.add("unsupported-success-claim");
  if (result.reason === "cycle-detected" && result.controlStatus !== "bottom") classes.add("no-bottom-return");
  if (result.transportStatus === "succeeded" && result.lambdaStatus === "satisfied" && result.semanticStatus !== "satisfied") classes.add("lambda-blur");
  if (result.pluginStatus === "plugin-not-found") classes.add("plugin-resolution-failure");
  return [...classes];
}

function descriptor(
  failureClass: FamFailureClass,
  family: FailureFamily,
  source: FailureDescriptor["source"],
): FailureDescriptor {
  return Object.freeze({ failureClass, family, source });
}
