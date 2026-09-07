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
import { readFamJson, validateFamJson } from "@fquery/fam-core";
import {
  FAM_DRAFT_PATCH_SCHEMA_VERSION,
  applyFamPatch,
  diffJson,
  escapeToken,
  getAtPointer,
  openFamText,
  parsePointer,
  patchFromDiff,
  serializeFamValue,
  type FamDraftPatch,
  type FamEditReceipt,
  type FamPatch,
  type JsonValue,
} from "@fquery/fam-edit";

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

export interface PlaygroundSession {
  readonly session: PresentationSession;
  readonly receipts: EditReceiptStore;
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
      if (property !== "fam.patch" && property !== "fam.text") return undefined;
      if (node.value === null || node.value === undefined) return { rejected: "fam-not-provided" };
      let document;
      try {
        document = readFamJson(serializeFamValue(node.value as JsonValue));
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
      if (decision.status === "rejected") return { rejected: decision.receipt.reason ?? "fam-edit-rejected" };
      const semantic = "unknown";
      return {
        ...node,
        value: decision.document.value,
        badges: [{ axis: "semantic", value: semantic, tone: statusTone(semantic) }],
        evidenceRefs: [...node.evidenceRefs, `fam-edit://${decision.receipt.operationId}/${decision.receipt.resultRevisionId}`],
      };
    },
  }), { registry });
  return { session, receipts };
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
