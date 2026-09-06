import {
  createHostOutboundMessage,
  parseHostInboundMessage,
  type FQueryHostStateListener,
  type FQueryUiEvent,
} from "@fquery/ui-core";

export interface VsCodeWebviewApi {
  postMessage(message: unknown): void;
}

export interface VsCodeHostBridge {
  dispatch(event: FQueryUiEvent): void;
  receive(message: unknown): boolean;
  subscribe(listener: FQueryHostStateListener): () => void;
}

export function createVsCodeHostBridge(api: VsCodeWebviewApi): VsCodeHostBridge {
  const listeners = new Set<FQueryHostStateListener>();
  return Object.freeze({
    dispatch(event: FQueryUiEvent) {
      api.postMessage(createHostOutboundMessage("vscode", event));
    },
    receive(message: unknown) {
      const parsed = parseHostInboundMessage(message);
      if (!parsed) return false;
      for (const listener of listeners) listener(parsed.nodes);
      return true;
    },
    subscribe(listener: FQueryHostStateListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  });
}
