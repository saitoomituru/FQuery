import { describe, expect, it, vi } from "vitest";
import { createVsCodeHostBridge } from "../src/index.js";

describe("VS Code host bridge", () => {
  it("typed UI eventをprotocol envelopeでpostする", () => {
    const postMessage = vi.fn();
    const bridge = createVsCodeHostBridge({ postMessage });
    bridge.dispatch({ type: "inspect", nodeId: "q://host/vscode" });
    expect(postMessage).toHaveBeenCalledWith({
      protocol: "fquery-host/0.1.0-draft",
      source: "vscode",
      type: "ui-event",
      event: { type: "inspect", nodeId: "q://host/vscode" },
    });
  });

  it("不正なruntime messageを破棄する", () => {
    const bridge = createVsCodeHostBridge({ postMessage: vi.fn() });
    const listener = vi.fn();
    bridge.subscribe(listener);
    expect(bridge.receive({ protocol: "other", type: "state", nodes: [] })).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });
});
