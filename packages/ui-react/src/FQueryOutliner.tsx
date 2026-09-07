import { useRef, type MouseEvent } from "react";
import type { ConnectionViewModel, FQueryUiEvent, NodeSelection, NodeViewModel, PresentationProjection } from "@fquery/ui-core";

export interface FQueryOutlinerProps {
  readonly nodes: readonly NodeViewModel[];
  readonly selection: NodeSelection;
  readonly connections?: readonly ConnectionViewModel[] | undefined;
  readonly presentations?: Readonly<Record<string, PresentationProjection>> | undefined;
  readonly onEvent: (event: FQueryUiEvent) => void;
}

/**
 * 階層（outliner）。graph上のnodeを一覧し、click→select request、focusボタン→focus event。
 * 選択の正本はsessionなので、ここでは選択を確定しない。
 */
export function FQueryOutliner({ nodes, selection, connections, presentations, onEvent }: FQueryOutlinerProps) {
  const sequence = useRef(0);

  function select(node: NodeViewModel, additive: boolean) {
    sequence.current += 1;
    const current = selection.nodeIds;
    const nodeIds = additive ? (current.includes(node.nodeId) ? current.filter((id) => id !== node.nodeId) : [...current, node.nodeId]) : [node.nodeId];
    const activeNodeId = nodeIds.includes(node.nodeId) ? node.nodeId : nodeIds.at(-1);
    onEvent({ type: "node.select.requested", requestId: `ui:outliner:${sequence.current}`, nodeIds, ...(activeNodeId ? { activeNodeId } : {}) });
  }

  const rows = nodes.map((node) => {
    const connectionCount = (connections ?? []).filter((connection) => node.ports.some((port) => port.portId === connection.fromPortId || port.portId === connection.toPortId)).length;
    const projection = presentations?.[node.nodeId];
    return { node, connectionCount, mode: projection?.mode ?? "none", semantic: node.badges.find((badge) => badge.axis === "semantic") };
  });

  return (
    <nav className="fquery-outliner" aria-label="node outliner">
      {rows.length === 0 ? <p className="fquery-outliner-muted">nodeなし</p> : (
        <ul role="listbox" aria-label="nodes">
          {rows.map((row) => (
            <li
              key={row.node.nodeId}
              role="option"
              data-node-id={row.node.nodeId}
              data-presentation-mode={row.mode}
              aria-selected={selection.nodeIds.includes(row.node.nodeId) ? "true" : "false"}
              data-active={selection.activeNodeId === row.node.nodeId ? "true" : undefined}
            >
              <button
                type="button"
                className="fquery-outliner-select"
                onClick={(event: MouseEvent) => select(row.node, event.shiftKey || event.metaKey || event.ctrlKey)}
                onDoubleClick={() => onEvent({ type: "focus", nodeId: row.node.nodeId })}
              >
                <strong>{row.node.label}</strong>
                <small>{row.node.nodeId}</small>
              </button>
              <span className="fquery-outliner-meta">
                <span className="fquery-outliner-links" title={`${row.connectionCount} connection(s)`}>⟷{row.connectionCount}</span>
                {row.semantic && <span className="fquery-badge" data-axis="semantic" data-tone={row.semantic.tone}><small>semantic</small>{row.semantic.value}</span>}
                {row.mode === "ghost" && <span className="fquery-outliner-ghost" title="plugin未ロード／消失">ghost</span>}
              </span>
              <button type="button" className="fquery-outliner-focus" aria-label={`focus ${row.node.label}`} title="focus" onClick={() => onEvent({ type: "focus", nodeId: row.node.nodeId })}>⌖</button>
            </li>
          ))}
        </ul>
      )}
    </nav>
  );
}
