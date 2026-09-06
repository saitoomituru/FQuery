import { describe, expect, it } from "vitest";
import type { QueryResult } from "@fquery/core";
import { classifyResult, diffFamLogs, FamLog } from "../src/index.js";

describe("FamLog", () => {
  it("append-only sequenceと時刻を付与する", () => {
    const log = new FamLog({ clock: () => new Date("2026-09-06T01:00:00.000Z") });
    log.append({ eventType: "query-received", queryRef: "q://test", status: "received" });
    log.append({ eventType: "result", queryRef: "q://test", status: "result" });
    expect(log.entries().map((entry) => entry.sequence)).toEqual([1, 2]);
    expect(log.entries()[0]?.observedAt).toBe("2026-09-06T01:00:00.000Z");
  });

  it("nested secretを保存しない", () => {
    const log = new FamLog();
    const entry = log.append({ eventType: "plugin-call-start", queryRef: "q://test", status: "running", detail: { headers: { authorization: "Bearer raw", safe: "ok" }, apiToken: "raw" } });
    expect(entry.detail).toEqual({ headers: { authorization: "[REDACTED]", safe: "ok" }, apiToken: "[REDACTED]" });
  });

  it("event typeとstatus差分だけを安定比較する", () => {
    const left = new FamLog({ clock: () => new Date(0) });
    const right = new FamLog({ clock: () => new Date(1) });
    left.append({ eventType: "result", queryRef: "q://test", status: "result" });
    right.append({ eventType: "last-order", queryRef: "q://test", status: "blocked" });
    expect(diffFamLogs(left.entries(), right.entries())).toHaveLength(1);
  });

  it("plugin-not-foundを個別分類する", () => {
    const result: QueryResult = {
      queryRef: "q://test",
      resolutionStatus: "unresolved",
      connectionStatus: "not-applicable",
      transportStatus: "not-started",
      pluginStatus: "plugin-not-found",
      semanticStatus: "unknown",
      lambdaStatus: "unknown",
      controlStatus: "last-order",
      evidenceRefs: [],
    };
    expect(classifyResult(result)).toContain("plugin-resolution-failure");
  });
});
