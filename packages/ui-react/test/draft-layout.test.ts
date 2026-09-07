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

describe("GuiRequestFactory.move", () => {
  it("layoutSlotRefはsessionのpresentations側から解決する", async () => {
    const { GuiRequestFactory } = await import("../src/model/gui-requests.js");
    const factory = new GuiRequestFactory("t");
    const node = { nodeId: "n1", label: "n1", badges: [], ports: [], value: null, evidenceRefs: [], canExecute: false, canCancel: false } as const;
    expect(factory.move(node, 1, 2)).toBeUndefined();
    const projection = { targetRef: "n1", mode: "native" as const, rendererId: "react-flow", presentation: { schemaVersion: "fquery.presentation-fam/0.1.0-draft" as const, presentationId: "p", targetRef: "n1", surfaces: ["node-editor" as const], visualRole: "v", interfaceRoles: [], visibility: "visible" as const, layoutSlotRef: "layout://fixture/1" } };
    expect(factory.move(node, 1, 2, projection)).toMatchObject({ type: "node.move.requested", nodeId: "n1", layoutSlotRef: "layout://fixture/1", x: 1, y: 2 });
  });
});
