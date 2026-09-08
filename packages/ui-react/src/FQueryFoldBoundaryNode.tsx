import { memo } from "react";
import type { NodeProps } from "@xyflow/react";
import { useCanvasContext } from "./canvas-context.js";

/** atomic recursive FoldのD/G closure境界。子graph全体が一つのdispatch単位であることを表示する。 */
function FQueryFoldBoundaryNodeComponent({ id, selected }: NodeProps) {
  const context = useCanvasContext();
  const model = context?.modelById.get(id);
  const boundary = model?.foldBoundary;
  if (!model || !boundary) return <div className="fquery-fold-boundary">Fold boundary未接続</div>;
  const collapsed = model.collapsed === true;
  return (
    <section
      className="fquery-fold-boundary"
      data-node-id={id}
      data-selected={selected ? "true" : undefined}
      data-boundary-ref={boundary.boundaryRef}
      data-resolution-mode={boundary.resolutionMode}
      data-dispatch-mode={boundary.dispatchMode}
      data-status={boundary.status}
      data-collapsed={collapsed ? "true" : "false"}
    >
      <header><strong>{model.label}</strong><span>generation {boundary.generation} · {boundary.status}</span></header>
      <small>G={formatStats(boundary.boundaryMetrics.G)} · D={boundary.boundaryMetrics.D} · L={formatStats(boundary.boundaryMetrics.L)}/{boundary.boundaryMetrics.L.continuity} · mL={formatStats(boundary.boundaryMetrics.mL)} · child={boundary.boundaryMetrics.direct_child_count} · S={boundary.boundaryMetrics.S.socket_present ? "ready" : boundary.boundaryMetrics.S.on_missing}</small>
      <small>atomic-resolution · single-processing-unit</small>
      <button
        type="button"
        className="fquery-fold-boundary-toggle nodrag nowheel"
        aria-expanded={!collapsed}
        onClick={() => context?.emit({
          type: "property.change.requested",
          requestId: `ui:fold-presentation:${Date.now()}`,
          targetRef: id,
          property: "fold.presentation-collapsed",
          value: { collapsed: !collapsed },
        })}
      >{collapsed ? "ひらく-DeFold-" : "まとめる-Fold-"}</button>
    </section>
  );
}

export const FQueryFoldBoundaryNode = memo(FQueryFoldBoundaryNodeComponent);

function formatStats(value: { readonly max: number; readonly median: number; readonly min: number }): string {
  return `${value.max}/${value.median}/${value.min}`;
}
