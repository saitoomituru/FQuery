export interface FQueryRecordsPanelProps {
  readonly fam?: unknown;
  readonly semanticProjection?: unknown;
  readonly famLog?: unknown;
  readonly providerReceipt?: unknown;
  readonly debugEvents?: unknown;
}

/** FAM／projection／FAMLog／receipt／debugのread-only表示。canonicalの複製表示であり正本ではない。 */
export function FQueryRecordsPanel({ fam, semanticProjection, famLog, providerReceipt, debugEvents }: FQueryRecordsPanelProps) {
  return (
    <section className="fquery-records" aria-label="FQuery records">
      <Record kind="fam" title="FAM" value={fam} empty="NOT IMPLEMENTED / 未生成" />
      <Record kind="semantic-projection" title="Semantic block projection" value={semanticProjection} empty="未生成" />
      <Record kind="famlog" title="FAMLog" value={famLog} empty="NOT PROVIDED" />
      <Record kind="provider-receipt" title="Provider receipt" value={providerReceipt} empty="NOT PROVIDED" />
      <Record kind="debug-event" title="Debug event" value={debugEvents} empty="NOT PROVIDED" />
    </section>
  );
}

function Record({ kind, title, value, empty }: { readonly kind: string; readonly title: string; readonly value: unknown; readonly empty: string }) {
  return (
    <article className="fquery-record" data-record-kind={kind}>
      <h2>{title}</h2>
      {value ? <pre>{JSON.stringify(value, null, 2)}</pre> : <p>{empty}</p>}
    </article>
  );
}
