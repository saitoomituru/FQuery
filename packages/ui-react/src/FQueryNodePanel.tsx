import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { deriveKnownPointers, type ConnectionViewModel, type FQueryUiEvent, type NodeViewModel, type PluginPresentationRegistration, type PresentationProjection, type QSchemaProperty } from "@fquery/ui-core";
import { createFamDraftPatch, getAtPointer, openFamText, partitionPointers, serializeFamValue, type FamValidator, type JsonValue } from "@fquery/fam-edit";
import { FQueryFamvim } from "./FQueryFamvim.js";

export type NodePanelTab = "settings" | "connections" | "q" | "unsupported" | "raw";

export interface FQueryNodePanelProps {
  readonly node: NodeViewModel;
  readonly registration?: PluginPresentationRegistration | undefined;
  readonly projection?: PresentationProjection | undefined;
  readonly connections?: readonly ConnectionViewModel[] | undefined;
  readonly validate?: FamValidator | undefined;
  /** Hostからtabを指定する（例: canvas nodeの「RAW編集」からRAW FAMを開く） */
  readonly tab?: NodePanelTab | undefined;
  /** 1 tab分だけをsectionとして描画する（pane contribution用）。tab stripとheaderは出さない */
  readonly only?: NodePanelTab | undefined;
  /** only="raw"のときにFAMVIMへ渡すjump先pointer */
  readonly jumpPointer?: string | null | undefined;
  /** Hostがnode固有のinspector（Ψ.NLのdecomposer binding等）を差し込むslot。GUI Coreはその内容を解釈しない */
  readonly inspector?: ReactNode;
  readonly onEvent: (event: FQueryUiEvent) => void;
}

const TABS: readonly { readonly id: NodePanelTab; readonly label: string }[] = [
  { id: "settings", label: "設定" },
  { id: "connections", label: "接続" },
  { id: "q", label: "Q" },
  { id: "unsupported", label: "Unsupported Data" },
  { id: "raw", label: "RAW FAM" },
];

/**
 * Q-schema駆動Node Panel（Issue #27）。
 * pluginが認識するQ fieldだけを編集し、認識できないfield／subtreeは
 * Unsupported Dataとして列挙し、RAW FAM（FAMVIM）で常に到達可能にする。
 * `unsupported != invalid`、`GUI controllerにない != dataが存在しない`。
 */
export function FQueryNodePanel({ node, registration, projection, connections, validate, tab, only, jumpPointer, inspector, onEvent }: FQueryNodePanelProps) {
  const [activeState, setActiveState] = useState<NodePanelTab>(tab ?? "settings");
  const [jumpTo, setJumpTo] = useState<string | null>(null);
  const sequence = useRef(0);
  const active: NodePanelTab = only ?? activeState;

  // node またはpluginが切り替わったときだけtabを初期化する（valueの更新では維持する）
  const identity = `${node.nodeId} ${registration?.presentation.presentationId ?? ""}`;
  const firstIdentity = useRef(identity);
  useEffect(() => {
    if (firstIdentity.current === identity) return;
    firstIdentity.current = identity;
    setActiveState(tab ?? "settings");
    setJumpTo(null);
    // identityが変わったときだけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity]);
  useEffect(() => { if (tab) setActiveState(tab); }, [tab]);
  useEffect(() => { if (jumpPointer !== undefined) setJumpTo(jumpPointer); }, [jumpPointer]);

  const editor = registration?.editor;
  const knownPointers = useMemo(() => deriveKnownPointers(editor), [editor]);
  const canonical = useMemo(() => node.value === null || node.value === undefined ? undefined : openFamText(serializeFamValue(node.value as JsonValue)), [node.value]);
  const canonicalValue = canonical?.parse === "parsed" ? canonical.value : undefined;
  const partition = useMemo(() => canonicalValue === undefined ? undefined : partitionPointers(canonicalValue, knownPointers), [canonicalValue, knownPointers]);
  const qProperties = Object.entries(editor?.qSchema?.properties ?? {});
  const ghost = projection?.mode === "ghost" || (!registration && projection !== undefined);
  const nodeConnections = (connections ?? []).filter((connection) => node.ports.some((port) => port.portId === connection.fromPortId || port.portId === connection.toPortId));

  const qValue = (key: string): JsonValue | undefined => canonicalValue === undefined ? undefined : getAtPointer(canonicalValue, qPointer(key));
  const inputValue = (key: string): string => {
    const current = qValue(key);
    return current === undefined || current === null ? "" : typeof current === "string" ? current : JSON.stringify(current);
  };

  function requestQChange(key: string, property: QSchemaProperty, raw: string | boolean) {
    if (property.readOnly) return;
    const exists = qValue(key) !== undefined;
    const path = qPointer(key);
    const coerced = coerce(property, raw);
    sequence.current += 1;
    onEvent({
      type: "property.change.requested",
      requestId: `ui:node-panel:${sequence.current}`,
      targetRef: node.nodeId,
      property: "fam.patch",
      value: createFamDraftPatch([exists ? { op: "set", path, value: coerced } : { op: "insert", path, value: coerced }]),
    });
  }

  function requestDisconnect(connection: ConnectionViewModel) {
    sequence.current += 1;
    onEvent({ type: "connection.remove.requested", requestId: `ui:node-panel:${sequence.current}`, connectionId: connection.connectionId });
  }

  function jumpToRaw(pointer: string) {
    if (only) {
      // sectionとして分割されているときはHostへjumpを委ね、Hostがpane tabを切り替える
      onEvent({ type: "jump", nodeId: node.nodeId, pointer });
      return;
    }
    setJumpTo(pointer);
    setActiveState("raw");
  }

  return (
    <section className="fquery-node-panel" data-node-id={node.nodeId} data-only={only} aria-label="FQuery node panel">
      {(!only || only === "settings") && (
        <header>
          {!only && <h3>{node.label}</h3>}
          {ghost && <p className="fquery-node-panel-ghost" role="status">ghost: plugin未ロード／消失。dataは保持され、RAW FAMで編集可能</p>}
        </header>
      )}

      {!only && (
        <div className="fquery-node-panel-tabs" role="tablist" aria-label="node panel tabs">
          {TABS.map((entry) => (
            <button key={entry.id} type="button" role="tab" data-tab={entry.id} aria-selected={active === entry.id ? "true" : "false"} onClick={() => setActiveState(entry.id)}>
              {entry.label}{entry.id === "unsupported" && partition && <small> ({partition.unsupported.length})</small>}
            </button>
          ))}
        </div>
      )}

      {active === "settings" && (
        <section role="tabpanel" data-tab-panel="settings">
          <dl>
            <dt>nodeId</dt><dd>{node.nodeId}</dd>
            <dt>plugin</dt><dd>{registration ? `${registration.pluginId}@${registration.pluginVersion}` : "NOT REGISTERED"}</dd>
            <dt>capability</dt><dd>{registration?.capability ?? "-"}</dd>
            <dt>famRole</dt><dd>{editor?.famRole ?? "undeclared"}</dd>
            <dt>presentation</dt><dd>{projection ? `${projection.mode} / ${projection.rendererId}` : "-"}{projection?.reason && <span> — {projection.reason}</span>}</dd>
          </dl>
          {inspector}
        </section>
      )}

      {active === "connections" && (
        <section role="tabpanel" data-tab-panel="connections">
          <ul className="fquery-node-panel-ports">
            {node.ports.map((port) => <li key={port.portId} data-direction={port.direction} data-connection={port.connectionStatus}>{port.direction} {port.label}: {port.connectionStatus}</li>)}
          </ul>
          <ul className="fquery-node-panel-connections">
            {nodeConnections.map((connection) => (
              <li key={connection.connectionId}>
                <code>{connection.fromPortId} → {connection.toPortId}</code>
                <button type="button" onClick={() => requestDisconnect(connection)}>切断をrequest</button>
              </li>
            ))}
          </ul>
          {nodeConnections.length === 0 && <p className="fquery-node-panel-muted">unconnected（failureではない）</p>}
        </section>
      )}

      {active === "q" && (
        <section role="tabpanel" data-tab-panel="q">
          {qProperties.length === 0
            ? <p className="fquery-node-panel-muted">このpluginはQ schemaを宣言していない。Q fieldはUnsupported DataまたはRAW FAMから編集する</p>
            : canonicalValue === undefined
              ? <p className="fquery-node-panel-muted">canonical FAM未生成</p>
              : (
                <div className="fquery-node-panel-q">
                  {qProperties.map(([key, property]) => (
                    <label key={key} data-q-key={key}>
                      <span>{property.label ?? key}{property.readOnly && <small> read-only</small>}</span>
                      {property.type === "boolean"
                        ? <input type="checkbox" checked={Boolean(qValue(key))} disabled={property.readOnly} onChange={(event) => requestQChange(key, property, event.target.checked)} />
                        : property.type === "enum"
                          ? (
                            <select value={inputValue(key)} disabled={property.readOnly} onChange={(event) => requestQChange(key, property, event.target.value)}>
                              {(property.enum ?? []).map((candidate) => <option key={candidate} value={candidate}>{candidate}</option>)}
                            </select>
                          )
                          : <input type={property.type === "number" ? "number" : "text"} defaultValue={inputValue(key)} disabled={property.readOnly} onBlur={(event) => { if (event.target.value !== inputValue(key)) requestQChange(key, property, event.target.value); }} onKeyDown={(event) => { if (event.key === "Enter") (event.target as HTMLInputElement).blur(); }} />}
                      {qValue(key) === undefined && <small className="fquery-node-panel-muted">未設定（insertとしてrequest）</small>}
                    </label>
                  ))}
                </div>
              )}
        </section>
      )}

      {active === "unsupported" && (
        <section role="tabpanel" data-tab-panel="unsupported">
          <p className="fquery-node-panel-muted">このpanelが編集できないがcanonical FAMに存在するfield。無効ではなく、RAW FAMで編集できる</p>
          {partition ? (
            <ul className="fquery-node-panel-unsupported">
              {partition.unsupported.map((pointer) => (
                <li key={pointer}>
                  <code>{pointer}</code>
                  <button type="button" data-jump={pointer} onClick={() => jumpToRaw(pointer)}>RAWへ</button>
                </li>
              ))}
            </ul>
          ) : <p className="fquery-node-panel-muted">canonical FAM未生成</p>}
        </section>
      )}

      {active === "raw" && (
        <section role="tabpanel" data-tab-panel="raw">
          <FQueryFamvim targetRef={node.nodeId} value={node.value ?? undefined} validate={validate} knownPointers={knownPointers} jumpTo={jumpTo} onEvent={onEvent} />
        </section>
      )}
    </section>
  );
}

function qPointer(key: string): string {
  return `/Q/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`;
}

function coerce(property: QSchemaProperty, raw: string | boolean): JsonValue {
  if (property.type === "boolean") return Boolean(raw);
  if (property.type === "number") { const parsed = Number(raw); return Number.isFinite(parsed) ? parsed : String(raw); }
  return String(raw);
}
