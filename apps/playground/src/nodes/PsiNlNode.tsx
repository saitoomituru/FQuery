import type { NodeRendererProps } from "@fquery/ui-react";
import { useDecomposer } from "../host/decomposer.js";

/** Ψ.NL Input renderer。自然言語sourceとdecomposer（provider route）binding。 */
export function PsiNlNode({ model, emit }: NodeRendererProps) {
  const context = useDecomposer();
  const selectedRoute = context?.routes.find((route) => route.provider === context.provider);
  const statusBadges = model.badges.filter((badge) => ["transport", "plugin", "semantic"].includes(badge.axis));
  const canExecute = Boolean(context && !context.running && selectedRoute?.available && context.model && context.source.trim());

  return (
    <div className="psi-node" aria-label="route controls">
      <label>source
        {context && <textarea className="nodrag" rows={4} spellCheck={false} value={context.source} onChange={(event) => context.setSource(event.target.value)} />}
      </label>
      {context && (
        <div className="psi-node-route">
          <label>decomposer
            <select className="nodrag" value={context.provider} onChange={(event) => context.setProvider(event.target.value as typeof context.provider)}>
              {context.routes.map((route) => <option key={route.provider} value={route.provider} disabled={!route.available}>{route.label}{route.available ? "" : " — unavailable"}</option>)}
            </select>
          </label>
          <label>model
            <select className="nodrag" value={context.model} onChange={(event) => context.setModel(event.target.value)}>
              {(selectedRoute?.models ?? []).map((candidate) => <option key={candidate} value={candidate}>{candidate}</option>)}
            </select>
          </label>
        </div>
      )}
      <div className="psi-node-actions">
        {context && <button type="button" className="nodrag psi-node-execute" disabled={!canExecute} onClick={() => void context.execute()}>{context.running ? "推論中…" : "分解を実行"}</button>}
        <button type="button" className="nodrag" onClick={() => emit({ type: "inspect", nodeId: model.nodeId })}>inspector</button>
      </div>
      <div className="psi-node-badges">
        {statusBadges.map((badge) => <span key={badge.axis} className="fquery-badge" data-axis={badge.axis} data-tone={badge.tone}><small>{badge.axis}</small>{badge.value}</span>)}
      </div>
      {context?.error && <p className="psi-node-error" role="alert">Last Order: <code>{context.error}</code></p>}
      {selectedRoute?.credentialName && <p className="psi-node-muted">credential: {selectedRoute.credentialName}</p>}
    </div>
  );
}
