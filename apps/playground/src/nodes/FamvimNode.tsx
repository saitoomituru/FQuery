import { useEffect, useState } from "react";
import type { NodeRendererProps } from "@fquery/ui-react";
import { isRecord } from "../host/decomposer.js";
import { useLocalization } from "../i18n.js";

/** ∇φ.FAMVIM renderer。canonical FAMの要約を表示し、RAW編集はinspectorへ委譲する（React版では未移植）。 */
export function FamvimNode({ model, emit }: NodeRendererProps) {
  if (model.foldRef) return <IndependentFoldNode model={model} emit={emit} />;
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

function IndependentFoldNode({ model, emit }: NodeRendererProps) {
  const { t } = useLocalization();
  const wrapper = isRecord(model.value) ? model.value : undefined;
  const unit = isRecord(wrapper?.unit) ? wrapper.unit : undefined;
  const lambda = isRecord(unit?.λ) ? unit.λ : undefined;
  const q = isRecord(unit?.Q) ? unit.Q : undefined;
  const classification = isRecord(wrapper?.classification) ? wrapper.classification : undefined;
  const manifestation = typeof lambda?.manifestation === "string" ? lambda.manifestation : "";
  const [draft, setDraft] = useState(manifestation);
  useEffect(() => setDraft(manifestation), [manifestation]);
  const changed = draft !== manifestation && draft.trim().length > 0;
  return (
    <div className="famvim-node fold-unit-node" data-fold-ref={model.foldRef} data-projection-freshness={model.projectionFreshness}>
      <p className="famvim-node-title"><strong>{manifestation}</strong></p>
      <p className="famvim-node-meta"><code>{model.foldRef}</code></p>
      <p className="famvim-node-meta">revision: <code>{model.revisionRef ?? String(q?.unit_revision_ref ?? "unknown")}</code></p>
      <p className="famvim-node-meta">{t("unit.dimension")}: <code>{String(classification?.dimensionRef ?? "unmapped")}</code></p>
      <details className="fold-unit-evidence nowheel"><summary>{t("unit.evidence")}</summary><ul>{model.evidenceRefs.map((ref) => <li key={ref}><code>{ref}</code></li>)}</ul></details>
      <label className="fold-unit-editor nowheel">意味単位を局所差替え
        <textarea className="nodrag" rows={3} value={draft} onChange={(event) => setDraft(event.target.value)} />
      </label>
      <div className="famvim-node-actions">
        <button type="button" className="nodrag" disabled={!changed} onClick={() => emit({
          type: "property.change.requested",
          requestId: `ui:unit-replace:${Date.now()}`,
          targetRef: model.nodeId,
          property: "unit.replace",
          value: { replacementText: draft, claimKind: "world-fact", overrideObserverRef: "observer://playground/user", overrideSourceRef: `input://playground/user-override/${Date.now()}` },
        })}>{t("unit.replace")}</button>
        <button type="button" className="nodrag" onClick={() => emit({
          type: "property.change.requested",
          requestId: `ui:recursive-decompose:${Date.now()}`,
          targetRef: model.nodeId,
          property: "unit.recursive-decompose",
          value: { sourceText: manifestation },
        })}>{t("unit.why")}</button>
        <button type="button" className="nodrag" onClick={() => emit({ type: "inspect", nodeId: model.nodeId })}>{t("unit.details")}</button>
      </div>
    </div>
  );
}

function unitText(unit: unknown): string {
  if (!isRecord(unit) || !isRecord(unit.λ)) return "";
  return typeof unit.λ.manifestation === "string" ? unit.λ.manifestation : "";
}
