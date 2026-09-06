import type { CoreEvent, QueryResult } from "@fquery/core";

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

export type DivergenceClass = "port-hallucination" | "unsupported-success-claim" | "no-bottom-return" | "lambda-blur" | "plugin-resolution-failure" | "cross-runtime-divergence";

export function classifyResult(result: QueryResult): readonly DivergenceClass[] {
  const classes = new Set<DivergenceClass>();
  if (result.connectionStatus === "unconnected" && result.controlStatus === "bottom") classes.add("port-hallucination");
  if (result.transportStatus === "succeeded" && result.lambdaStatus === "satisfied" && result.evidenceRefs.length === 0) classes.add("unsupported-success-claim");
  if (result.reason === "cycle-detected" && result.controlStatus !== "bottom") classes.add("no-bottom-return");
  if (result.transportStatus === "succeeded" && result.lambdaStatus === "satisfied" && result.semanticStatus !== "satisfied") classes.add("lambda-blur");
  if (result.pluginStatus === "plugin-not-found") classes.add("plugin-resolution-failure");
  return [...classes];
}
