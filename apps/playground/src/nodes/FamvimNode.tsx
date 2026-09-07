import type { NodeRendererProps } from "@fquery/ui-react";
import { isRecord } from "../host/decomposer.js";

/** ∇φ.FAMVIM renderer。canonical FAMの要約を表示し、RAW編集はinspectorへ委譲する（React版では未移植）。 */
export function FamvimNode({ model, emit }: NodeRendererProps) {
  const fam = isRecord(model.value) ? model.value : undefined;
  const lambda = fam?.λ;
  const units = isRecord(lambda) && Array.isArray(lambda.output_units) ? lambda.output_units : [];
  const q = fam?.Q;
  const unknowns = isRecord(q) && Array.isArray(q.unknowns) ? q.unknowns.length : 0;
  const semantic = model.badges.find((badge) => badge.axis === "semantic");

  return (
    <div className="famvim-node">
      {fam ? (
        <>
          <p className="famvim-node-title"><strong>{String(fam.title ?? "")}</strong></p>
          <p className="famvim-node-meta"><code>{String(fam.fam_id ?? "")}</code> · units={units.length} · unknowns={unknowns}</p>
          <ol className="famvim-node-units nowheel">
            {units.slice(0, 5).map((unit, index) => <li key={index}>{unitText(unit)}</li>)}
            {units.length > 5 && <li className="famvim-node-muted">… 他{units.length - 5}件</li>}
          </ol>
        </>
      ) : (
        <p className="famvim-node-muted">canonical FAM未生成 — Ψ.NLから分解を実行</p>
      )}
      <div className="famvim-node-actions">
        <button type="button" className="nodrag" onClick={() => emit({ type: "inspect", nodeId: model.nodeId })}>RAW編集 / Unsupported Data</button>
        {semantic && <span className="fquery-badge" data-axis="semantic" data-tone={semantic.tone}><small>semantic</small>{semantic.value}</span>}
      </div>
    </div>
  );
}

function unitText(unit: unknown): string {
  if (!isRecord(unit) || !isRecord(unit.λ)) return "";
  return typeof unit.λ.manifestation === "string" ? unit.λ.manifestation : "";
}
