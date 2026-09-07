import { describe, expect, it } from "vitest";
import type { PresentationDecision } from "@fquery/ui-core";
import { EMPTY_DRAFT_LAYOUT, markDraftRequested, reconcileDraft, setDraftPosition } from "../src/model/draft-layout.js";

const decision = (requestId: string, status: PresentationDecision["status"]): PresentationDecision => ({
  kind: "node.move",
  requestId,
  status,
  nodeId: "n1",
  evidenceRefs: [],
  ...(status === "accepted" ? { layout: { nodeId: "n1", x: 250, y: 90 } } : {}),
});

describe("draft layout", () => {
  it("drag中の座標はdecisionが届くまで保持し、届いたら破棄する", () => {
    let state = setDraftPosition(EMPTY_DRAFT_LAYOUT, "n1", { x: 250, y: 90 });
    state = markDraftRequested(state, "n1", "ui:move:1");
    expect(reconcileDraft(state, [], [{ nodeId: "n1", x: 10, y: 20 }]).positions.get("n1")).toEqual({ x: 250, y: 90 });

    const rejected = reconcileDraft(state, [decision("ui:move:1", "rejected")], [{ nodeId: "n1", x: 10, y: 20 }]);
    expect(rejected.positions.has("n1")).toBe(false);
    expect(rejected.pendingRequests.has("n1")).toBe(false);
  });

  it("acceptedでも暫定座標は消え、表示はaccepted layoutの再投影に委ねる", () => {
    let state = setDraftPosition(EMPTY_DRAFT_LAYOUT, "n1", { x: 250, y: 90 });
    state = markDraftRequested(state, "n1", "ui:move:1");
    const accepted = reconcileDraft(state, [decision("ui:move:1", "accepted")], [{ nodeId: "n1", x: 250, y: 90 }]);
    expect(accepted.positions.size).toBe(0);
  });

  it("requestを伴わない暫定座標はaccepted layoutと一致した時点で消える", () => {
    const state = setDraftPosition(EMPTY_DRAFT_LAYOUT, "n1", { x: 10, y: 20 });
    expect(reconcileDraft(state, [], [{ nodeId: "n1", x: 10, y: 20 }]).positions.size).toBe(0);
    expect(reconcileDraft(state, [], [{ nodeId: "n1", x: 11, y: 20 }]).positions.size).toBe(1);
  });
});
