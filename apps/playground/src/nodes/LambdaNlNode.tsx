import type { NodeRendererProps } from "@fquery/ui-react";
import { isRecord } from "../host/decomposer.js";

/** λ.NL Output renderer。投影されたmanifestationを表示するだけで、λ satisfactionをGUIで判定しない。 */
export function LambdaNlNode({ model }: NodeRendererProps) {
  const output = isRecord(model.value) ? model.value : undefined;
  const lines = Array.isArray(output?.manifestations) ? output.manifestations.filter((line): line is string => typeof line === "string") : [];
  const lambda = model.badges.find((badge) => badge.axis === "lambda");

  return (
    <div className="lambda-node">
      {lines.length ? (
        <>
          <p className="lambda-node-meta">{String(output?.projection_kind ?? "projection")} · {lines.length} line(s)</p>
          <pre className="lambda-node-output nowheel">{lines.join("\n")}</pre>
        </>
      ) : (
        <p className="lambda-node-muted">NOT PROVIDED — 上流FAMから出力がまだ投影されていない</p>
      )}
      {lambda && <span className="fquery-badge" data-axis="lambda" data-tone={lambda.tone}><small>λ</small>{lambda.value}</span>}
    </div>
  );
}
