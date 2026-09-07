import { createContext, useContext } from "react";
import type { FQueryUiEvent, PluginPresentationRegistration, PresentationProjection, PresentationSessionState } from "@fquery/ui-core";
import type { FamValidator } from "@fquery/fam-edit";

/** Core receiptをGUIへ投影する非再帰のread-only view。canonical receipt自体はHostが保持する。 */
export interface PlaygroundEditReceiptView {
  readonly status: "accepted" | "rejected";
  readonly operationId: string;
  readonly baseRevisionId: string;
  readonly resultRevisionId: string | null;
  readonly patchCount: number;
  readonly validationIssueCount: number;
  readonly reason?: string;
  readonly losses: readonly string[];
  readonly sourceMutation: false;
  readonly beforeSha256: string;
  readonly afterSha256: string | null;
}

/** pane section componentへHostが渡す状態。GUI Coreは知らない。 */
export interface PlaygroundPaneContextValue {
  readonly sessionState: PresentationSessionState;
  readonly registrations: readonly PluginPresentationRegistration[];
  readonly fam: unknown;
  readonly semanticProjection: unknown;
  readonly providerReceipt: unknown;
  readonly debugEvents: unknown;
  readonly famLog: unknown;
  readonly editReceipts: readonly PlaygroundEditReceiptView[];
  readonly selectedRegistration: PluginPresentationRegistration | undefined;
  readonly selectedProjection: PresentationProjection | undefined;
  readonly inspectorJump: string | null;
  readonly validate: FamValidator;
  readonly receive: (event: FQueryUiEvent) => void;
}

export const PlaygroundPaneContext = createContext<PlaygroundPaneContextValue | undefined>(undefined);
export function usePlaygroundPane(): PlaygroundPaneContextValue | undefined {
  return useContext(PlaygroundPaneContext);
}
