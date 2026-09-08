import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { PortViewModel } from "@fquery/ui-core";
import { useCanvasContext } from "./canvas-context.js";

/** atomic recursive FoldのD/G closure境界。子graph全体が一つのdispatch単位であることを表示する。 */
function FQueryFoldBoundaryNodeComponent({ id, selected }: NodeProps) {
  const context = useCanvasContext();
  const model = context?.modelById.get(id);
  const boundary = model?.foldBoundary;
  if (!model || !boundary) return <div className="fquery-fold-boundary">Fold boundary未接続</div>;
  const collapsed = model.collapsed === true;
  const outerPsi = model.ports.find((port) => port.portId.endsWith(":psi") && port.direction === "input");
  const innerPsi = model.ports.find((port) => port.portId.endsWith(":children") && port.direction === "output");
  const innerLambda = model.ports.find((port) => port.portId.endsWith(":return") && port.direction === "input");
  const outerLambda = model.ports.find((port) => port.portId.endsWith(":fam") && port.direction === "output");
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
      {outerPsi && <BoundaryGate portId={outerPsi.portId} label={outerPsi.label} connectionStatus={outerPsi.connectionStatus} gate="outer-psi" type="target" position={Position.Left} top="4rem" />}
      {innerPsi && <BoundaryGate portId={innerPsi.portId} label={innerPsi.label} connectionStatus={innerPsi.connectionStatus} gate="inner-psi" type="source" position={Position.Left} top="7rem" />}
      {innerLambda && <BoundaryGate portId={innerLambda.portId} label={innerLambda.label} connectionStatus={innerLambda.connectionStatus} gate="inner-lambda" type="target" position={Position.Right} top="7rem" />}
      {outerLambda && <BoundaryGate portId={outerLambda.portId} label={outerLambda.label} connectionStatus={outerLambda.connectionStatus} gate="outer-lambda" type="source" position={Position.Right} top="4rem" />}
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

function BoundaryGate({ portId, label, connectionStatus, gate, type, position, top }: {
  readonly portId: string;
  readonly label: string;
  readonly connectionStatus: PortViewModel["connectionStatus"];
  readonly gate: "outer-psi" | "inner-psi" | "inner-lambda" | "outer-lambda";
  readonly type: "source" | "target";
  readonly position: Position;
  readonly top: string;
}) {
  return (
    <div className="fquery-fold-boundary-gate nodrag" data-gate={gate} data-port-id={portId} data-connection-status={connectionStatus} data-side={position === Position.Left ? "left" : "right"} style={{ top }}>
      <Handle type={type} position={position} id={portId} />
      <span>{label}</span>
    </div>
  );
}

function formatStats(value: { readonly max: number; readonly median: number; readonly min: number }): string {
  return `${value.max}/${value.median}/${value.min}`;
}
