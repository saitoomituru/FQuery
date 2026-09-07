import { describe, expect, it } from "vitest";
import { planParallelFold } from "../src/index.js";

describe("semantic parallel Fold planner", () => {
  it("独立childを同じwaveへ置き依存childを後続waveへ送る", () => {
    const plan = planParallelFold("resolved", [
      { childRef: "child://a", dependsOn: [], status: "ready" },
      { childRef: "child://b", dependsOn: [], status: "ready" },
      { childRef: "child://c", dependsOn: ["child://a", "child://b"], status: "ready" },
    ]);
    expect(plan.waves).toEqual([["child://a", "child://b"], ["child://c"]]);
    expect(plan.blocked).toEqual([]);
    expect(plan.parallelExecutionAuthorized).toBe(false);
  });

  it("parent context未確定時はchildを実行候補へ入れない", () => {
    const plan = planParallelFold("unknown", [{ childRef: "child://a", dependsOn: [], status: "ready" }]);
    expect(plan.waves).toEqual([]);
    expect(plan.blocked).toEqual([{ childRef: "child://a", reason: "parent-context-unresolved", dependencyRefs: [] }]);
  });

  it("未検証childと欠損依存を別reasonで返す", () => {
    const plan = planParallelFold("resolved", [
      { childRef: "child://unknown", dependsOn: [], status: "unverified" },
      { childRef: "child://missing", dependsOn: ["child://absent"], status: "ready" },
    ]);
    expect(plan.blocked).toEqual(expect.arrayContaining([
      { childRef: "child://unknown", reason: "child-status-unverified", dependencyRefs: [] },
      { childRef: "child://missing", reason: "dependency-not-found", dependencyRefs: ["child://absent"] },
    ]));
  });

  it("cycleをbottomや成功へ潰さずblocked dependencyとして保持する", () => {
    const plan = planParallelFold("resolved", [
      { childRef: "child://a", dependsOn: ["child://b"], status: "ready" },
      { childRef: "child://b", dependsOn: ["child://a"], status: "ready" },
    ]);
    expect(plan.waves).toEqual([]);
    expect(plan.blocked.map((item) => item.reason)).toEqual(["dependency-cycle-or-blocked", "dependency-cycle-or-blocked"]);
  });
});
