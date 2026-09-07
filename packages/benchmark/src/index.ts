import { evaluateQ, type EvaluationContext, type QueryNode, type QueryResult, type StatusAxes } from "@fquery/core";
import { diffFamLogs, FamLog, type FamLogDifference, type FamLogEntry } from "@fquery/famlog";

export { assessNegativeFixture, validateNegativeFixture } from "./negative-fixture.js";
export type * from "./negative-fixture.js";

export interface BenchmarkTarget {
  readonly targetId: string;
  readonly context: Omit<EvaluationContext, "emit">;
}

export interface BenchmarkRun {
  readonly targetId: string;
  readonly result: QueryResult;
  readonly log: readonly FamLogEntry[];
}

export type ResultAxis = keyof StatusAxes;

export interface ResultAxisDifference {
  readonly axis: ResultAxis;
  readonly left: StatusAxes[ResultAxis];
  readonly right: StatusAxes[ResultAxis];
}

export interface BenchmarkComparison {
  readonly baselineTargetId: string;
  readonly targetId: string;
  readonly resultDifferences: readonly ResultAxisDifference[];
  readonly logDifferences: readonly FamLogDifference[];
}

export interface BenchmarkReport {
  readonly queryRef: string;
  readonly runs: readonly BenchmarkRun[];
  readonly comparisons: readonly BenchmarkComparison[];
}

const RESULT_AXES: readonly ResultAxis[] = [
  "resolutionStatus",
  "connectionStatus",
  "transportStatus",
  "pluginStatus",
  "semanticStatus",
  "lambdaStatus",
  "controlStatus",
];

export async function runBenchmark(query: QueryNode, targets: readonly BenchmarkTarget[]): Promise<BenchmarkReport> {
  if (targets.length < 2) throw new RangeError("benchmark requires at least two targets");
  const runs = await Promise.all(targets.map(async ({ targetId, context }) => {
    const log = new FamLog();
    const result = await evaluateQ(query, { ...context, emit: (event) => log.append(event) });
    return Object.freeze({ targetId, result, log: log.entries() });
  }));
  const baseline = runs[0]!;
  const comparisons = runs.slice(1).map((run) => Object.freeze({
    baselineTargetId: baseline.targetId,
    targetId: run.targetId,
    resultDifferences: compareResultAxes(baseline.result, run.result),
    logDifferences: diffFamLogs(baseline.log, run.log),
  }));
  return Object.freeze({ queryRef: query.queryId, runs: Object.freeze(runs), comparisons: Object.freeze(comparisons) });
}

export function compareResultAxes(left: QueryResult, right: QueryResult): readonly ResultAxisDifference[] {
  return RESULT_AXES.flatMap((axis) => left[axis] === right[axis] ? [] : [{ axis, left: left[axis], right: right[axis] }]);
}
