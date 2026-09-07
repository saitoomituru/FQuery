import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { FQueryGenericNodeContent } from "./FQueryGenericNodeContent.js";
import { useCanvasContext } from "./canvas-context.js";

/**
 * canvas上のnode 1個。header、portとしてのHandle、node本体の順に描画する。
 * port座標はReact FlowのHandleが所有し、FQuery側でDOMを測らない。
 * 本体はPresentation FAMの`rendererHint`に対応するplugin rendererへ委譲する。
 */
function FQueryFlowNodeComponent({ id, selected }: NodeProps) {
  const context = useCanvasContext();
  const model = context?.modelById.get(id);
  const projection = context?.presentations[id];
  if (!context || !model) {
    return <div className="fquery-flow-node" data-node-id={id}><p className="fquery-canvas-node-muted">projection未接続</p></div>;
  }
  const hint = projection?.presentation?.rendererHint;
  const Renderer = projection?.mode === "native" && hint ? context.renderers[hint] : undefined;
  const inputs = model.ports.filter((port) => port.direction === "input");
  const outputs = model.ports.filter((port) => port.direction === "output");

  return (
    <div className="fquery-flow-node" data-node-id={id} data-selected={selected ? "true" : undefined} data-presentation-mode={projection?.mode ?? "none"}>
      <header className="fquery-flow-node-title">{model.label}</header>
      <div className="fquery-flow-node-ports">
        <ul className="fquery-flow-node-ports-column" data-direction="input">
          {inputs.map((port) => (
            <li key={port.portId} className="fquery-flow-port" data-port-id={port.portId} data-connection-status={port.connectionStatus}>
              <Handle type="target" position={Position.Left} id={port.portId} />
              <span>{port.label}</span>
            </li>
          ))}
        </ul>
        <ul className="fquery-flow-node-ports-column" data-direction="output">
          {outputs.map((port) => (
            <li key={port.portId} className="fquery-flow-port" data-port-id={port.portId} data-connection-status={port.connectionStatus}>
              <span>{port.label}</span>
              <Handle type="source" position={Position.Right} id={port.portId} />
            </li>
          ))}
        </ul>
      </div>
      <div className="fquery-canvas-node nowheel" data-node-id={id} data-presentation-mode={projection?.mode ?? "none"}>
        {Renderer
          ? <Renderer model={model} projection={projection} emit={context.emit} />
          : <FQueryGenericNodeContent model={model} projection={projection} emit={context.emit} />}
      </div>
    </div>
  );
}

export const FQueryFlowNode = memo(FQueryFlowNodeComponent);
