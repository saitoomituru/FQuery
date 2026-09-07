import type { PresentationSessionState } from "@fquery/ui-core";

/** Session decisionsのreceipt表示。GUIはこれを意味判定へ昇格しない。 */
export function DecisionsPanel({ state }: { readonly state: PresentationSessionState }) {
  const decisions = [...state.decisions].reverse();
  return (
    <section className="panel" aria-label="session decisions">
      <h2>Decisions <small>pending={state.pending.length}</small></h2>
      <ol className="decision-list">
        {decisions.map((decision) => (
          <li key={decision.requestId} data-status={decision.status}>
            <code>{decision.kind}</code> <strong>{decision.status}</strong>
            {decision.reason && <span> — {decision.reason}</span>}
            <small>{decision.requestId}</small>
          </li>
        ))}
      </ol>
    </section>
  );
}
