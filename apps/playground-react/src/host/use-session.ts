import { useSyncExternalStore } from "react";
import type { PresentationSession, PresentationSessionState } from "@fquery/ui-core";

/** sessionをReactの外部storeとして購読する。session stateをReact stateへ複製しない。 */
export function useSessionState(session: PresentationSession): PresentationSessionState {
  return useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.state,
    () => session.state,
  );
}
