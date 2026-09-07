import { useSyncExternalStore } from "react";
import type { PresentationSession, PresentationSessionState } from "@fquery/ui-core";
import type { FamEditReceipt } from "@fquery/fam-edit";
import type { EditReceiptStore } from "./session.js";

/** sessionをReactの外部storeとして購読する。session stateをReact stateへ複製しない。 */
export function useSessionState(session: PresentationSession): PresentationSessionState {
  return useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.state,
    () => session.state,
  );
}

export function useEditReceipts(store: EditReceiptStore): readonly FamEditReceipt[] {
  return useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.receipts,
    () => store.receipts,
  );
}
