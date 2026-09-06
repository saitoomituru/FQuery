import { describe, expect, it } from "vitest";
import { Q, type PluginResolver } from "@fquery/core";
import { runBenchmark } from "../src/index.js";

const successful: PluginResolver = {
  async invoke(request) {
    return { pluginId: "plugin://test/success", value: request.input, transportStatus: "succeeded", evidenceRefs: ["evidence://test/success"] };
  },
};

const failed: PluginResolver = {
  async invoke() {
    return { pluginId: "plugin://test/failure", transportStatus: "failed", reason: "fixture-failure" };
  },
};

describe("runBenchmark", () => {
  it("同一Qを複数routeへ渡し状態軸とFAMLogを比較する", async () => {
    const query = Q(
      { kind: "literal", value: { message: "hello" } },
      { queryId: "q://fixture/benchmark", operations: [{ kind: "invoke", capability: "echo" }] },
    );
    const report = await runBenchmark(query, [
      { targetId: "model-a/plugin-success", context: { pluginResolver: successful } },
      { targetId: "model-b/plugin-failure", context: { pluginResolver: failed } },
    ]);
    expect(report.runs).toHaveLength(2);
    expect(report.comparisons[0]?.resultDifferences).toContainEqual({ axis: "transportStatus", left: "succeeded", right: "failed" });
    expect(report.comparisons[0]?.logDifferences.length).toBeGreaterThan(0);
  });

  it("一つのtargetだけでは比較済みを名乗らない", async () => {
    const query = Q({ kind: "literal", value: null }, { queryId: "q://fixture/insufficient" });
    await expect(runBenchmark(query, [{ targetId: "only", context: {} }])).rejects.toThrow("at least two targets");
  });
});
