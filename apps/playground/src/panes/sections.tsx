import { FQueryNodePanel, FQueryOutliner, FQueryPalette, FQueryRecordsPanel, type NodePanelTab, type PaneSectionProps } from "@fquery/ui-react";
import { usePlaygroundPane } from "../context.js";
import { useDecomposer } from "../host/decomposer.js";

/**
 * pane contribution（Issue #33）のsection component群。
 * それぞれHost contextから状態を受け取り、GUI Coreのcomponentへ橋渡しするだけでModelを書かない。
 * 1 section 1 componentとして分離し、componentRef → componentの解決はApp側のmapで行う。
 */

export function AddNodeSection() {
  const host = usePlaygroundPane();
  return host ? <FQueryPalette registrations={host.registrations} onEvent={host.receive} /> : null;
}

export function OutlinerSection() {
  const host = usePlaygroundPane();
  if (!host) return null;
  return <FQueryOutliner nodes={host.sessionState.nodes} selection={host.sessionState.selection} connections={host.sessionState.connections} presentations={host.sessionState.presentations} onEvent={host.receive} />;
}

export function RecordsSection() {
  const host = usePlaygroundPane();
  return host ? <FQueryRecordsPanel fam={host.fam} semanticProjection={host.semanticProjection} providerReceipt={host.providerReceipt} debugEvents={host.debugEvents} /> : null;
}

export function DecisionsSection() {
  const host = usePlaygroundPane();
  if (!host) return null;
  return (
    <div className="session-receipt">
      {host.editReceipts.length > 0 && (
        <section aria-label="fam edit receipts">
          <h2>FAM edit receipts</h2>
          <ul>
            {host.editReceipts.map((receipt, index) => (
              <li key={index} data-edit-status={receipt.status}>
                <strong>{receipt.status}</strong> <code>{receipt.operationId}</code> revision={receipt.baseRevisionId} → {receipt.resultRevisionId ?? "-"} patches={receipt.patchCount}
                {receipt.validationIssueCount > 0 && <span> validator={receipt.validationIssueCount} issue(s)</span>}
                {receipt.reason && <span> — {receipt.reason}</span>}
                {receipt.losses.length > 0 && <span> loss={receipt.losses.join(",")}</span>}
                <small> sourceMutation={String(receipt.sourceMutation)} sha256={receipt.beforeSha256.slice(0, 8)}→{receipt.afterSha256?.slice(0, 8) ?? "-"}</small>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section aria-label="session decisions">
        <h2>Session decisions</h2>
        <ul>
          {host.sessionState.decisions.map((decision) => (
            <li key={decision.requestId} data-decision-status={decision.status}>
              <code>{decision.kind}</code> {decision.requestId} → <strong>{decision.status}</strong>{decision.reason && <span> — {decision.reason}</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function NodePanelSection({ only, context }: { readonly only: NodePanelTab } & Pick<PaneSectionProps, "context">) {
  const host = usePlaygroundPane();
  if (!host || !context.activeNode) return <p className="fquery-pane-muted">active nodeなし</p>;
  const panelNode = only === "raw" && host.fam !== undefined ? { ...context.activeNode, value: host.fam } : context.activeNode;
  const jumpPointer = only === "raw" ? canonicalJumpPointer(host.inspectorJump, host.selectedRegistration?.editor?.famRole, host.fam !== undefined) : undefined;
  return (
    <FQueryNodePanel
      only={only}
      node={panelNode}
      registration={host.selectedRegistration}
      projection={host.selectedProjection}
      connections={host.sessionState.connections}
      validate={host.validate}
      jumpPointer={jumpPointer}
      onEvent={host.receive}
    />
  );
}

/** node局所pointerを、親canonical FAMを表示するRAW panel上のpointerへ写像する。 */
function canonicalJumpPointer(pointer: string | null, famRole: string | undefined, displaysParentFam: boolean): string | undefined {
  if (!pointer) return undefined;
  if (!displaysParentFam || !famRole || famRole === "∇φ") return pointer;
  return `/${famRole}${pointer}`;
}

export const NodeSettingsSection = ({ context }: PaneSectionProps) => <NodePanelSection only="settings" context={context} />;
export const NodeConnectionsSection = ({ context }: PaneSectionProps) => <NodePanelSection only="connections" context={context} />;
export const NodeQSection = ({ context }: PaneSectionProps) => <NodePanelSection only="q" context={context} />;
export const NodeUnsupportedSection = ({ context }: PaneSectionProps) => <NodePanelSection only="unsupported" context={context} />;
export const NodeRawSection = ({ context }: PaneSectionProps) => <NodePanelSection only="raw" context={context} />;

/** Host contribution: Ψ.NL nodeがactiveのときだけ右paneへ出るdecomposer route設定。 */
export function DecomposerSection() {
  const context = useDecomposer();
  if (!context) return null;
  const selectedRoute = context.routes.find((route) => route.provider === context.provider);
  const canExecute = !context.running && Boolean(selectedRoute?.available) && Boolean(context.model) && Boolean(context.source.trim());
  return (
    <section className="controls" aria-label="route controls (inspector)">
      <label>Provider
        <select value={context.provider} onChange={(event) => context.setProvider(event.target.value as typeof context.provider)}>
          {context.routes.map((route) => <option key={route.provider} value={route.provider} disabled={!route.available}>{route.label}{route.available ? "" : " — unavailable"}</option>)}
        </select>
      </label>
      <label>Model
        <select value={context.model} onChange={(event) => context.setModel(event.target.value)}>
          {(selectedRoute?.models ?? []).map((candidate) => <option key={candidate} value={candidate}>{candidate}</option>)}
        </select>
      </label>
      <p className="route-note">route: {context.provider} / {context.model}{selectedRoute?.credentialName && <> / credential: {selectedRoute.credentialName}</>}{selectedRoute?.reason && <> / {selectedRoute.reason}</>}</p>
      <label className="source">Natural language source<textarea rows={6} value={context.source} onChange={(event) => context.setSource(event.target.value)} /></label>
      <button type="button" disabled={!canExecute} onClick={() => void context.execute()}>{context.running ? "推論中…" : "自然言語をFAMへ分解"}</button>
    </section>
  );
}
