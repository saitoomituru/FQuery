import { act, cleanup, render } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FQueryUiEvent, NodeViewModel } from "@fquery/ui-core";
import { FQueryFlowView } from "../src/FQueryFlowView.js";
import type { PresentationCanvasHandle } from "../src/model/canvas-handle.js";

const model = (nodeId: string, ports: NodeViewModel["ports"], layoutSlotRef?: string): NodeViewModel => ({
  nodeId,
  label: nodeId,
  badges: [{ axis: "semantic", value: "unknown", tone: "unknown" }],
  ports,
  value: null,
  evidenceRefs: [],
  canExecute: false,
  canCancel: false,
  ...(layoutSlotRef ? {
    presentation: {
      targetRef: nodeId,
      mode: "generic" as const,
      rendererId: "react-flow",
      presentation: {
        schemaVersion: "fquery.presentation-fam/0.1.0-draft" as const,
        presentationId: `presentation://${nodeId}`,
        targetRef: nodeId,
        surfaces: ["node-editor" as const],
        visualRole: "test",
        interfaceRoles: [],
        visibility: "visible" as const,
        layoutSlotRef,
      },
    },
  } : {}),
});

afterEach(cleanup);

describe("FQueryFlowView", () => {
  const left = model("q://left", [{ portId: "q://left:out", label: "out", direction: "output", connectionStatus: "connected" }], "layout://left");
  const right = model("q://right", [{ portId: "q://right:in", label: "in", direction: "input", connectionStatus: "connected" }]);

  it("NodeViewModelをnodeとして描画し、portをHandleとして持つ", () => {
    const { container } = render(
      <FQueryFlowView nodes={[left, right]} connections={[{ connectionId: "c1", fromPortId: "q://left:out", toPortId: "q://right:in" }]} layout={[{ nodeId: left.nodeId, x: 10, y: 20 }, { nodeId: right.nodeId, x: 300, y: 20 }]} onEvent={() => {}} />,
    );
    const nodes = container.querySelectorAll(".fquery-flow-node");
    expect(nodes).toHaveLength(2);
    expect(container.querySelector('[data-port-id="q://left:out"] .react-flow__handle')).not.toBeNull();
    expect(container.querySelector('[data-node-id="q://left"] .fquery-badge')?.textContent).toContain("unknown");
  });

  it("generic fallbackのinspectはFQueryUiEventとして親へ届く", () => {
    const events: FQueryUiEvent[] = [];
    const { container } = render(<FQueryFlowView nodes={[left]} layout={[{ nodeId: left.nodeId, x: 0, y: 0 }]} onEvent={(event) => events.push(event)} />);
    act(() => { (container.querySelector('[data-node-id="q://left"] button') as HTMLButtonElement).click(); });
    expect(events).toEqual([{ type: "inspect", nodeId: "q://left" }]);
  });

  it("canvas handleはfocusNodeで存在しないnodeにfalseを返す", () => {
    const ref = createRef<PresentationCanvasHandle>();
    render(<FQueryFlowView ref={ref} nodes={[left]} layout={[]} onEvent={vi.fn()} />);
    expect(ref.current?.focusNode("missing")).toBe(false);
    expect(ref.current?.focusNode("q://left")).toBe(true);
    expect(typeof ref.current?.viewportCenter().x).toBe("number");
  });
});
