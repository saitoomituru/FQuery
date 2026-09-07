import type { FQueryUiEvent, NodeViewModel } from "@fquery/ui-core";

export interface FQueryNodeProps {
  readonly model: NodeViewModel;
  readonly onEvent: (event: FQueryUiEvent) => void;
}

/** canvas外のnode card表示（Host一覧やfixture描画向け）。Modelを書かない。 */
export function FQueryNode({ model, onEvent }: FQueryNodeProps) {
  const request = (type: "inspect" | "preview" | "execute-request" | "cancel-request") => onEvent({ type, nodeId: model.nodeId });
  return (
    <article className="fquery-node" data-node-id={model.nodeId} aria-label={model.label}>
      <header>
        <h3>{model.label}</h3>
        <button type="button" onClick={() => request("inspect")}>inspect</button>
      </header>
      {model.presentation && (
        <p className="fquery-presentation-state" data-presentation-mode={model.presentation.mode}>
          presentation: {model.presentation.mode} / {model.presentation.rendererId}
          {model.presentation.reason && <span>— {model.presentation.reason}</span>}
        </p>
      )}
      <div className="fquery-badges" aria-label="Q status axes">
        {model.badges.map((badge) => <span key={badge.axis} className="fquery-badge" data-axis={badge.axis} data-tone={badge.tone}><small>{badge.axis}</small>{badge.value}</span>)}
      </div>
      <div className="fquery-ports">
        {model.ports.map((port) => <span key={port.portId} className="fquery-port" data-direction={port.direction} data-connection={port.connectionStatus}>{port.label}: {port.connectionStatus}</span>)}
      </div>
      {model.lastOrder && (
        <section className="fquery-last-order" aria-label="Last Order">
          <strong>{model.lastOrder.code}</strong>
          <p>{model.lastOrder.reason}</p>
          <p>next: {model.lastOrder.requestedNext}</p>
          <p>resume: {model.lastOrder.resumeWhen}</p>
        </section>
      )}
      <footer>
        <button type="button" onClick={() => request("preview")}>preview</button>
        <button type="button" disabled={!model.canExecute} onClick={() => request("execute-request")}>execute</button>
        <button type="button" disabled={!model.canCancel} onClick={() => request("cancel-request")}>cancel</button>
      </footer>
    </article>
  );
}

export function FQueryPanel({ nodes, onEvent }: { readonly nodes: readonly NodeViewModel[]; readonly onEvent: (event: FQueryUiEvent) => void }) {
  return (
    <main className="fquery-panel" aria-label="FQuery node viewer">
      {nodes.map((node) => <FQueryNode key={node.nodeId} model={node} onEvent={onEvent} />)}
    </main>
  );
}
