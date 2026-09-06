import { describe, expect, it, vi } from "vitest";
import { createSphereHostBridge } from "../src/index.js";

describe("Sphere host bridge", () => {
  it("VS Codeと同じprotocol envelopeをSphere portへ送る", () => {
    const send = vi.fn();
    const bridge = createSphereHostBridge({ send });
    bridge.dispatch({ type: "preview", nodeId: "q://host/sphere" });
    expect(send).toHaveBeenCalledWith({
      protocol: "fquery-host/0.1.0-draft",
      source: "sphere",
      type: "ui-event",
      event: { type: "preview", nodeId: "q://host/sphere" },
    });
  });

  it("unsubscribe後はstate通知を渡さない", () => {
    const bridge = createSphereHostBridge({ send: vi.fn() });
    const listener = vi.fn();
    const unsubscribe = bridge.subscribe(listener);
    unsubscribe();
    expect(bridge.receive({ protocol: "fquery-host/0.1.0-draft", type: "state", nodes: [] })).toBe(true);
    expect(listener).not.toHaveBeenCalled();
  });
});
