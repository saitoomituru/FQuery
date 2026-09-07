import { useEffect, useMemo, useRef, useState } from "react";
import type { GuiEventAbi } from "@fquery/ui-core";
import {
  diffJson,
  getAtPointer,
  openFamText,
  partitionPointers,
  patchFromDiff,
  renderPointerLines,
  serializeFamValue,
  type FamValidator,
  type JsonValue,
} from "@fquery/fam-edit";

export interface FQueryFamvimProps {
  readonly targetRef: string;
  readonly value?: unknown;
  readonly text?: string | undefined;
  readonly validate?: FamValidator | undefined;
  readonly knownPointers?: readonly string[] | undefined;
  readonly jumpTo?: string | null | undefined;
  readonly onEvent: (event: GuiEventAbi) => void;
}

/**
 * ∇φ.FAMVIM — universal RAW FAM editor。
 * canonical FAMを直接表示・編集する最低限の正規GUIであり、debug viewerではない。
 * 編集はModelを書かず、property.change.requestedをemitするだけ。
 */
export function FQueryFamvim({ targetRef, value, text, validate, knownPointers, jumpTo, onEvent }: FQueryFamvimProps) {
  const sequence = useRef(0);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const [selectedPointer, setSelectedPointer] = useState("");

  const canonicalText = text ?? (value === undefined ? "" : serializeFamValue(value as JsonValue));
  const canonical = useMemo(() => canonicalText ? openFamText(canonicalText) : undefined, [canonicalText]);
  const [draft, setDraft] = useState(canonicalText);
  useEffect(() => { setDraft(canonicalText); }, [canonicalText]);

  const draftDocument = useMemo(() => draft ? openFamText(draft) : undefined, [draft]);
  const dirty = draft !== canonicalText;
  const diff = useMemo(() => canonical?.parse === "parsed" && draftDocument?.parse === "parsed" ? diffJson(canonical.value, draftDocument.value) : [], [canonical, draftDocument]);
  const validation = useMemo(() => validate && draftDocument?.parse === "parsed" ? validate(draftDocument.value) : undefined, [validate, draftDocument]);
  const render = useMemo(() => canonical?.parse === "parsed" ? renderPointerLines(canonical.value) : undefined, [canonical]);
  const unsupported = useMemo(() => new Set(canonical?.parse === "parsed" && knownPointers ? partitionPointers(canonical.value, knownPointers).unsupported : []), [canonical, knownPointers]);
  const authority = useMemo(() => {
    if (canonical?.parse !== "parsed") return undefined;
    const root = canonical.value;
    return { famId: getAtPointer(root, "/fam_id"), revisionId: getAtPointer(root, "/revision_id"), schemaVersion: getAtPointer(root, "/schema_version"), provenance: getAtPointer(root, "/provenance") };
  }, [canonical]);
  const canApply = dirty && draftDocument !== undefined && canonical !== undefined;

  function select(pointer: string) {
    setSelectedPointer(pointer);
    const line = render?.lines.find((entry) => entry.pointer === pointer)?.line;
    const element = editorRef.current;
    if (line === undefined || !element || dirty) return;
    const rows = draft.split("\n");
    const offset = rows.slice(0, line).reduce((total, current) => total + current.length + 1, 0);
    const lineLength = rows[line]?.length ?? 0;
    element.focus();
    element.setSelectionRange(offset, offset + lineLength);
  }

  useEffect(() => {
    if (jumpTo) select(jumpTo);
    // jumpToが変わったときだけ選択する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jumpTo, render]);

  function apply() {
    if (!canApply || !draftDocument) return;
    sequence.current += 1;
    const requestId = `ui:famvim:${sequence.current}`;
    if (draftDocument.parse === "parsed" && canonical?.parse === "parsed") {
      onEvent({ type: "property.change.requested", requestId, targetRef, property: "fam.patch", value: patchFromDiff(diff) });
      return;
    }
    // malformed draftは失わず、RAW置換requestとしてHostへ渡す。採否と loss receipt はHostが決める。
    onEvent({ type: "property.change.requested", requestId, targetRef, property: "fam.text", value: draft });
  }

  async function copyCanonical() {
    if (typeof navigator !== "undefined" && navigator.clipboard) await navigator.clipboard.writeText(canonicalText);
  }

  return (
    <section className="fquery-famvim" data-target-ref={targetRef} aria-label="FAMVIM RAW FAM editor">
      <header className="fquery-famvim-header">
        <h3>∇φ.FAMVIM</h3>
        {authority ? (
          <dl className="fquery-famvim-authority" aria-label="canonical authority">
            <dt>fam_id</dt><dd>{describe(authority.famId)}</dd>
            <dt>revision_id</dt><dd>{describe(authority.revisionId)}</dd>
            <dt>schema_version</dt><dd>{describe(authority.schemaVersion)}</dd>
          </dl>
        ) : canonical?.parse === "unparsed"
          ? <p className="fquery-famvim-warning" role="status">canonical text is unparsed: {canonical.parseError}</p>
          : <p className="fquery-famvim-muted">NOT PROVIDED / canonical FAM未生成</p>}
      </header>

      <div className="fquery-famvim-body">
        {render && (
          <nav className="fquery-famvim-paths" aria-label="FAM path navigation">
            <ul>
              {render.lines.filter((line) => line.pointer !== "").map((entry) => (
                <li key={entry.pointer}>
                  <button
                    type="button"
                    data-pointer={entry.pointer}
                    data-unsupported={unsupported.has(entry.pointer) ? "true" : undefined}
                    aria-current={selectedPointer === entry.pointer ? "true" : undefined}
                    onClick={() => select(entry.pointer)}
                  >{entry.pointer}{unsupported.has(entry.pointer) && <small> unsupported</small>}</button>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <label className="fquery-famvim-editor">
          <span>RAW FAM</span>
          <textarea ref={editorRef} value={draft} spellCheck={false} disabled={!canonical} rows={18} onChange={(event) => setDraft(event.target.value)} />
        </label>
      </div>

      <section className="fquery-famvim-status" aria-label="validator result">
        {draftDocument?.parse === "unparsed"
          ? <p className="fquery-famvim-warning" role="alert">draft unparsed（保持中）: {draftDocument.parseError}</p>
          : validation ? (
            <>
              <p data-valid={validation.valid ? "true" : "false"}>validator: {validation.valid ? "valid" : `${validation.issues.length} issue(s)`}</p>
              {!validation.valid && (
                <ul>
                  {validation.issues.map((issue) => <li key={`${issue.path}:${issue.code}`}><code>{issue.path}</code> {issue.code} — {issue.message}</li>)}
                </ul>
              )}
            </>
          ) : <p className="fquery-famvim-muted">validator: NOT PROVIDED</p>}
      </section>

      <section className="fquery-famvim-diff" aria-label="diff preview">
        {!dirty
          ? <p className="fquery-famvim-muted">diff: なし</p>
          : diff.length ? (
            <ul>
              {diff.map((entry) => (
                <li key={`${entry.path}:${entry.change}`} data-change={entry.change}>
                  <code>{entry.path}</code> {entry.change}
                  {entry.change !== "added" && <span> − {describe(entry.before)}</span>}
                  {entry.change !== "removed" && <span> + {describe(entry.after)}</span>}
                </li>
              ))}
            </ul>
          ) : <p className="fquery-famvim-muted">diff: textのみ変更（構造差分なし）またはunparsed</p>}
      </section>

      <footer className="fquery-famvim-actions">
        <button type="button" disabled={!canApply} onClick={apply}>編集をrequest</button>
        <button type="button" disabled={!dirty} onClick={() => setDraft(canonicalText)}>破棄</button>
        <button type="button" disabled={!canonicalText} onClick={() => void copyCanonical()}>canonicalをcopy</button>
      </footer>

      {authority?.provenance !== undefined && (
        <details className="fquery-famvim-provenance">
          <summary>provenance (read-only)</summary>
          <pre>{JSON.stringify(authority.provenance, null, 2)}</pre>
        </details>
      )}
    </section>
  );
}

function describe(input: unknown): string {
  return typeof input === "string" ? input : JSON.stringify(input);
}
