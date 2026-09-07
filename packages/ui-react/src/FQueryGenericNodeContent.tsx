import type { NodeViewModel, PresentationProjection } from "@fquery/ui-core";
import type { FQueryUiEvent } from "@fquery/ui-core";

interface Props {
  readonly model: NodeViewModel;
  readonly projection?: PresentationProjection | undefined;
  readonly emit: (event: FQueryUiEvent) => void;
}

/** rendererが無い／plugin消失（ghost）／renderer非対応（generic）のfallback card。dataは保持する。 */
export function FQueryGenericNodeContent({ model, projection, emit }: Props) {
  return (
    <div className="fquery-canvas-node-generic">
      {projection?.mode === "ghost" && <p className="fquery-canvas-node-ghost" role="status">ghost — plugin未ロード／消失。dataは保持</p>}
      {projection?.mode === "generic" && <p className="fquery-canvas-node-muted">generic — renderer未対応（{projection.reason ?? "no renderer"}）</p>}
      <div className="fquery-canvas-node-badges">
        {model.badges.map((badge) => (
          <span key={badge.axis} className="fquery-badge" data-axis={badge.axis} data-tone={badge.tone}><small>{badge.axis}</small>{badge.value}</span>
        ))}
      </div>
      <pre className="fquery-canvas-node-value">{summarize(model.value)}</pre>
      <button type="button" className="nodrag" onClick={() => emit({ type: "inspect", nodeId: model.nodeId })}>inspect</button>
    </div>
  );
}

function summarize(value: unknown): string {
  if (value === null || value === undefined) return "NOT PROVIDED";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}
