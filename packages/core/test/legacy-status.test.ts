import { describe, expect, it } from "vitest";
import { projectLegacyQStatus, summarizeAsLegacyQStatus, type StatusAxes } from "../src/index.js";

const axes: StatusAxes = {
  resolutionStatus: "resolved",
  connectionStatus: "unconnected",
  transportStatus: "failed",
  pluginStatus: "resolved",
  semanticStatus: "unknown",
  lambdaStatus: "unknown",
  controlStatus: "last-order",
};

describe("旧Q.status compatibility", () => {
  it("validated_in_contextから確実な軸だけを投影する", () => {
    const projection = projectLegacyQStatus("validated_in_context");
    expect(projection.constraints).toEqual({ resolutionStatus: "resolved", semanticStatus: "satisfied" });
    expect(projection.unmappedAxes).toContain("transportStatus");
    expect(projection.unmappedAxes).toContain("lambdaStatus");
  });

  it("failedの失敗軸を捏造しない", () => {
    const projection = projectLegacyQStatus("failed");
    expect(projection.constraints).toEqual({});
    expect(projection.unmappedAxes).toHaveLength(7);
    expect(projection.losses).toContain("失敗した軸と原因はlegacy statusだけでは判定不能");
  });

  it("現行軸を旧一値へ正確に戻せると表示しない", () => {
    const summary = summarizeAsLegacyQStatus(axes);
    expect(summary.exact).toBe(false);
    expect(summary.candidates).toEqual(expect.arrayContaining(["transferred_unverified", "partial_compatible", "patch_pending", "failed"]));
    expect(summary.candidates).not.toContain("deprecated");
    expect(summary.candidates).not.toContain("out_of_scope");
  });
});
