import {
  PluginPresentationRegistry,
  PresentationSession,
  CORE_RENDERER_HINT,
  createCoreNodeViewModel,
  createFixtureDecisionPort,
  findCoreNodeContract,
  registerCoreNodes,
  statusTone,
} from "@fquery/ui-core";
import { readFamJson, validateFamJson, type FamDocument, type FamJsonRecord } from "@fquery/fam-core";
import {
  FAM_DRAFT_PATCH_SCHEMA_VERSION,
  FamRevisionStore,
  applyFamPatch,
  diffJson,
  escapeToken,
  getAtPointer,
  openFamText,
  parsePointer,
  patchFromDiff,
  serializeFamValue,
  replaceFamUnit,
  type FamDraftPatch,
  type FamEditReceipt,
  type FamPatch,
  type JsonValue,
} from "@fquery/fam-edit";
import { FoldLog, type FoldLogAppendInput, type FoldLogRecord } from "@fquery/famlog";

export const PLAYGROUND_RENDERER_ID = "react-flow";

/** Core fam-edit receiptのHost側store。Reactへは購読で渡し、React stateへ複製しない。 */
export class EditReceiptStore {
  #receipts: readonly FamEditReceipt[] = Object.freeze([]);
  readonly #listeners = new Set<() => void>();
  get receipts(): readonly FamEditReceipt[] { return this.#receipts; }
  push(receipt: FamEditReceipt): void {
    this.#receipts = Object.freeze([...this.#receipts, receipt]);
    for (const listener of this.#listeners) listener();
  }
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  }
}

/** canonical FAMと全revisionをReact外で保持するHost store。 */
export class FamDocumentStore {
  #current: FamDocument | undefined;
  readonly #revisions = new FamRevisionStore();
  readonly #listeners = new Set<() => void>();
  get current(): FamDocument | undefined { return this.#current; }
  set(value: FamJsonRecord): FamDocument {
    const document = readFamJson(serializeFamValue(value));
    if (!this.#revisions.get(value.fam_id, value.revision_id)) this.#revisions.append(document);
    this.#current = document;
    for (const listener of this.#listeners) listener();
    return document;
  }
  setDecision(document: FamDocument): void {
    if (!this.#revisions.get(document.value.fam_id, document.value.revision_id)) this.#revisions.append(document);
    this.#current = document;
    for (const listener of this.#listeners) listener();
  }
  get(famId: string, revisionId: string): FamDocument | undefined { return this.#revisions.get(famId, revisionId); }
  subscribe(listener: () => void): () => void { this.#listeners.add(listener); return () => { this.#listeners.delete(listener); }; }
}

/** FoldLog alpha recordのvolatile Host store。IBD永続化を名乗らない。 */
export class FoldLogStore {
  readonly #log = new FoldLog();
  readonly #listeners = new Set<() => void>();
  #snapshot: readonly FoldLogRecord[] = Object.freeze([]);
  get records(): readonly FoldLogRecord[] { return this.#snapshot; }
  append(input: FoldLogAppendInput): FoldLogRecord {
    const record = this.#log.append(input);
    this.#snapshot = this.#log.records();
    for (const listener of this.#listeners) listener();
    return record;
  }
  last(): FoldLogRecord | undefined { return this.#snapshot.at(-1); }
  subscribe(listener: () => void): () => void { this.#listeners.add(listener); return () => { this.#listeners.delete(listener); }; }
}

export interface PlaygroundSession {
  readonly session: PresentationSession;
  readonly receipts: EditReceiptStore;
  readonly fams: FamDocumentStore;
  readonly logs: FoldLogStore;
}

/**
 * Host責務: sessionとregistryを構築する。GUIは判定を行わない。
 * Playgroundではengine不在のためfixture portが構造判定だけを返し、
 * FAMVIM／Node Panelからの`fam.patch`／`fam.text`はCore fam-edit engineで適用する。
 */
export function createPlaygroundSession(): PlaygroundSession {
  const registry = new PluginPresentationRegistry();
  registerCoreNodes(registry);
  const receipts = new EditReceiptStore();
  const fams = new FamDocumentStore();
  const logs = new FoldLogStore();
  let editSequence = 0;
  const session = new PresentationSession(createFixtureDecisionPort({
    registry,
    renderer: { rendererId: PLAYGROUND_RENDERER_ID, supportedHints: [CORE_RENDERER_HINT] },
    nodeIdPrefix: "q://playground/node",
    createNode: (capability, nodeId) => {
      const contract = findCoreNodeContract(capability);
      if (!contract) throw new Error(`core-contract-not-found:${capability}`);
      return createCoreNodeViewModel(contract, nodeId);
    },
    // Host責務: FAMVIM／Node Panelからのfam.patch / fam.textをcanonical valueへ適用する。GUIは適用しない。
    resolveProperty: (node, property, value, request) => {
      if (property === "unit.replace") {
        if (!node.foldRef || !fams.current) return { rejected: "unit-or-parent-fam-not-provided" };
        const replacement = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
        const replacementText = typeof replacement.replacementText === "string" ? replacement.replacementText : "";
        editSequence += 1;
        const result = replaceFamUnit(fams.current, {
          operationId: request.requestId,
          unitRef: node.foldRef,
          baseParentRevisionId: fams.current.value.revision_id,
          resultParentRevisionId: `rev://playground/fam-edit/${editSequence}`,
          resultUnitRevisionRef: `${node.foldRef}/revision/${editSequence + 1}`,
          replacementText,
          claimKind: typeof replacement.claimKind === "string" ? replacement.claimKind : "world-fact",
          overrideSourceRef: typeof replacement.overrideSourceRef === "string" ? replacement.overrideSourceRef : `input://playground/user-override/${editSequence}`,
          overrideObserverRef: typeof replacement.overrideObserverRef === "string" ? replacement.overrideObserverRef : "observer://playground/user",
        });
        receipts.push(result.decision.receipt);
        appendEditFoldLog(logs, node.foldRef, fams.current.value, result.decision.receipt);
        if (result.decision.status === "rejected") return { rejected: result.decision.receipt.reason ?? "fam-unit-replacement-rejected" };
        fams.setDecision(result.decision.document);
        const outputUnits = (result.decision.document.value.λ as { output_units?: unknown[] }).output_units ?? [];
        const changed = outputUnits.find((unit) => unit && typeof unit === "object" && !Array.isArray(unit) && (unit as { Q?: { unit_ref?: unknown } }).Q?.unit_ref === node.foldRef);
        return { ...node, value: { ...(node.value && typeof node.value === "object" && !Array.isArray(node.value) ? node.value as Record<string, unknown> : {}), unit: changed }, revisionRef: `${node.foldRef}/revision/${editSequence + 1}`, projectionFreshness: "unknown", evidenceRefs: [...node.evidenceRefs, `fam-edit://${request.requestId}/${result.decision.receipt.resultRevisionId}`] };
      }
      if (property !== "fam.patch" && property !== "fam.text") return undefined;
      const canonicalValue = fams.current?.value ?? node.value;
      if (canonicalValue === null || canonicalValue === undefined) return { rejected: "fam-not-provided" };
      let document;
      try {
        document = readFamJson(serializeFamValue(canonicalValue as JsonValue));
      } catch (error) {
        return { rejected: error instanceof Error ? `canonical-fam-invalid:${error.message}` : "canonical-fam-invalid" };
      }

      let draftPatch: FamDraftPatch;
      if (property === "fam.patch") {
        draftPatch = value as FamDraftPatch;
        if (draftPatch.schemaVersion !== FAM_DRAFT_PATCH_SCHEMA_VERSION) return { rejected: "unsupported-draft-patch-schema-version" };
      } else {
        const draft = openFamText(String(value));
        if (draft.parse === "unparsed") return { rejected: `fam-text-unparsed:${draft.parseError}` };
        draftPatch = patchFromDiff(diffJson(document.value, draft.value));
      }

      let patches: readonly FamPatch[];
      try {
        patches = toEnginePatches(document.value, draftPatch);
      } catch (error) {
        return { rejected: error instanceof Error ? error.message : "draft-patch-adapter-failed" };
      }
      if (patches.length === 0) return node;

      editSequence += 1;
      const decision = applyFamPatch(document, {
        operationId: request.requestId,
        baseRevisionId: document.value.revision_id,
        resultRevisionId: `rev://playground/fam-edit/${editSequence}`,
        patches,
      }, { validate: validateFamJson });
      receipts.push(decision.receipt);
      appendEditFoldLog(logs, node.foldRef ?? document.value.fam_id, document.value, decision.receipt);
      if (decision.status === "rejected") return { rejected: decision.receipt.reason ?? "fam-edit-rejected" };
      fams.setDecision(decision.document);
      const semantic = "unknown";
      return {
        ...node,
        value: decision.document.value,
        badges: [{ axis: "semantic", value: semantic, tone: statusTone(semantic) }],
        evidenceRefs: [...node.evidenceRefs, `fam-edit://${decision.receipt.operationId}/${decision.receipt.resultRevisionId}`],
      };
    },
  }), { registry });
  return { session, receipts, fams, logs };
}

function appendEditFoldLog(logs: FoldLogStore, sourceFoldRef: string, sourceFam: FamJsonRecord, receipt: FamEditReceipt): void {
  const q = sourceFam.Q as Record<string, unknown>;
  logs.append({
    traceId: `foldlog://playground/${sourceFam.fam_id}`,
    parentEventId: logs.last()?.eventId ?? null,
    operation: "edit",
    sourceFoldRef,
    affectedFoldRefs: [sourceFoldRef],
    sourceFamRef: sourceFam.fam_id,
    sourceRevisionRef: receipt.baseRevisionId,
    ...(receipt.resultRevisionId ? { resultFamRef: sourceFam.fam_id, resultRevisionRef: receipt.resultRevisionId } : {}),
    registryRef: typeof q.registry_ref === "string" ? q.registry_ref : "registry://fquery/playground/unknown",
    roles: { observerRef: "observer://playground/user", recorderRef: "recorder://fquery/playground/foldlog", initiatorRef: "observer://playground/user", executorRef: "executor://fquery/fam-edit", causalContributorRefs: [] },
    semanticStatus: receipt.status,
    projectionStatus: "unknown",
    cancelledEdgeRefs: [],
    selectedBranchRefs: [],
    recompositionRequired: false,
    beforeSha256: receipt.beforeSha256,
    ...(receipt.afterSha256 ? { afterSha256: receipt.afterSha256 } : {}),
    detail: { operationId: receipt.operationId, reason: receipt.reason ?? null, persistenceBoundary: "volatile-browser-memory" },
  });
}

/**
 * GUIのlossless draft patchをCore engineのoperationへ写像する。
 * object fieldのinsertはCoreのset（新規keyを許可）へ、array要素のinsertは
 * 親array path + indexへ変換する。採否とrevision更新はCoreだけが行う。
 */
export function toEnginePatches(sourceValue: JsonValue, draft: FamDraftPatch): readonly FamPatch[] {
  return Object.freeze(draft.operations.map((operation): FamPatch => {
    if (operation.op !== "insert") return operation;
    const tokens = parsePointer(operation.path);
    if (tokens.length === 0) return { op: "set", path: "", value: operation.value };
    const finalToken = tokens[tokens.length - 1]!;
    const parentPath = tokens.length === 1 ? "" : `/${tokens.slice(0, -1).map(escapeToken).join("/")}`;
    const parent = getAtPointer(sourceValue, parentPath);
    if (!Array.isArray(parent)) return { op: "set", path: operation.path, value: operation.value };
    const index = finalToken === "-" ? parent.length : Number(finalToken);
    if (!Number.isSafeInteger(index) || index < 0) throw new TypeError(`draft-array-index-invalid:${finalToken}`);
    return { op: "insert", path: parentPath, index, value: operation.value };
  }));
}
