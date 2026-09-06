import { describe, expect, it } from "vitest";
import type { QueryResult } from "@fquery/core";
import { createNodeViewModel, statusTone } from "../src/index.js";

const unconnected: QueryResult = {
  queryRef: "q://test/ui",
  resolutionStatus: "resolved",
  connectionStatus: "unconnected",
  transportStatus: "not-started",
  pluginStatus: "not-requested",
  semanticStatus: "unknown",
  lambdaStatus: "unknown",
  controlStatus: "result",
  evidenceRefs: [],
};

describe("UI Core", () => {
  it("unconnectedをdangerへ変換しない", () => {
    expect(statusTone("unconnected")).toBe("notice");
    expect(createNodeViewModel(unconnected).ports[1]?.connectionStatus).toBe("unconnected");
  });

  it("unknownとbottomを別toneへ写像する", () => {
    expect(statusTone("unknown")).toBe("unknown");
    expect(statusTone("bottom")).toBe("danger");
  });

  it("Last Orderを操作可能なViewModelとして保持する", () => {
    const viewModel = createNodeViewModel({
      ...unconnected,
      controlStatus: "last-order",
      lastOrder: { code: "WAIT", reason: "resource", requestedNext: "supply", resumeWhen: "available" },
    });
    expect(viewModel.lastOrder?.requestedNext).toBe("supply");
    expect(viewModel.canExecute).toBe(true);
  });
});
