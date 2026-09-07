import { describe, expect, it } from "vitest";
import { deliverOaeRecord, FoldLog, type FoldLogAppendInput } from "../src/index.js";

const base: FoldLogAppendInput = {
  traceId: "foldlog://issue-35/trace/1",
  parentEventId: null,
  operation: "decompose",
  sourceFoldRef: "fold://issue-35/psi",
  affectedFoldRefs: ["fold://issue-35/unit/1", "fold://issue-35/unit/2", "fold://issue-35/unit/3"],
  sourceFamRef: "fam://issue-35/rain",
  sourceRevisionRef: "rev://issue-35/rain/1",
  accessMapFamRef: "fam://fquery/test/basic-commons-access-mapper",
  accessMapRevisionRef: "rev://fquery/test/basic-commons-access-mapper/1",
  registryRef: "registry://fquery/test/basic-commons@1",
  roles: { observerRef: "observer://user", recorderRef: "recorder://fquery/fold-log", transformerRef: "transformer://fquery/decomposer", causalContributorRefs: [] },
  semanticStatus: "not-evaluated",
  projectionStatus: "fresh",
  cancelledEdgeRefs: [],
  selectedBranchRefs: [],
  recompositionRequired: false,
};

describe("FoldLog alpha OAE record", () => {
  it("OAE recordを生成しvolatile状態を正確に保持する", () => {
    const log = new FoldLog({ clock: () => new Date("2026-09-08T00:00:00.000Z") });
    const record = log.append(base);
    expect(record).toMatchObject({ schemaVersion: "fold.log/0.1.0-alpha", recordProfile: "oae.record/0.1.0-alpha", persistenceStatus: "volatile", sourceMutation: false, sequence: 1 });
    expect(record.roles).toMatchObject({ observerRef: "observer://user", recorderRef: "recorder://fquery/fold-log" });
  });

  it("秘密値をrecord detailへ保存しない", () => {
    const record = new FoldLog().append({ ...base, detail: { token: "secret", nested: { authorization: "bearer" }, safe: "retained" } });
    expect(record.detail).toEqual({ token: "[REDACTED]", nested: { authorization: "[REDACTED]" }, safe: "retained" });
  });

  it("IBD adapter受理と永続化完了を分離する", async () => {
    const record = new FoldLog().append(base);
    const receipt = await deliverOaeRecord(record, {
      sinkRef: "sink://ibd/test-adapter",
      append: (input) => ({ eventId: input.eventId, status: "adapter-accepted", sinkRef: "sink://ibd/test-adapter", receiptRef: "receipt://ibd/test/1", persisted: "unknown" }),
    });
    expect(receipt).toMatchObject({ status: "adapter-accepted", persisted: "unknown" });
  });
});
