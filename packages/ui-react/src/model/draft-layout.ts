import type { LayoutValue, PresentationDecision } from "@fquery/ui-core";

export interface DraftPosition {
  readonly x: number;
  readonly y: number;
}

/**
 * drag中の暫定座標。canonical layoutではなく、React Flowをcontrolledで使うための
 * 描画専用state。requestに対するdecisionが届くか、accepted layoutが更新されたら破棄する。
 * 破棄後はaccepted位置が再投影されるだけで、rollback用の補正codeを持たない。
 */
export interface DraftLayoutState {
  readonly positions: ReadonlyMap<string, DraftPosition>;
  /** nodeId -> 未決のmove requestId */
  readonly pendingRequests: ReadonlyMap<string, string>;
}

export const EMPTY_DRAFT_LAYOUT: DraftLayoutState = Object.freeze({
  positions: new Map(),
  pendingRequests: new Map(),
});

export function setDraftPosition(state: DraftLayoutState, nodeId: string, position: DraftPosition): DraftLayoutState {
  const positions = new Map(state.positions);
  positions.set(nodeId, Object.freeze({ x: position.x, y: position.y }));
  return Object.freeze({ ...state, positions });
}

/** drag終了時。requestIdを紐づけ、decisionが届くまで暫定座標を保持する。 */
export function markDraftRequested(state: DraftLayoutState, nodeId: string, requestId: string): DraftLayoutState {
  const pendingRequests = new Map(state.pendingRequests);
  pendingRequests.set(nodeId, requestId);
  return Object.freeze({ ...state, pendingRequests });
}

export function clearDraft(state: DraftLayoutState, nodeId: string): DraftLayoutState {
  if (!state.positions.has(nodeId) && !state.pendingRequests.has(nodeId)) return state;
  const positions = new Map(state.positions);
  const pendingRequests = new Map(state.pendingRequests);
  positions.delete(nodeId);
  pendingRequests.delete(nodeId);
  return Object.freeze({ positions, pendingRequests });
}

/**
 * sessionの決定履歴とaccepted layoutから、破棄すべき暫定座標を落とす。
 * accepted／rejected／unresolvedのいずれでも暫定座標は消え、表示はaccepted layoutへ戻る。
 */
export function reconcileDraft(
  state: DraftLayoutState,
  decisions: readonly PresentationDecision[],
  layout: readonly LayoutValue[],
): DraftLayoutState {
  let next = state;
  const decided = new Set(decisions.map((decision) => decision.requestId));
  for (const [nodeId, requestId] of state.pendingRequests) {
    if (decided.has(requestId)) next = clearDraft(next, nodeId);
  }
  for (const [nodeId, position] of next.positions) {
    if (next.pendingRequests.has(nodeId)) continue;
    const accepted = layout.find((value) => value.nodeId === nodeId);
    if (accepted && accepted.x === position.x && accepted.y === position.y) next = clearDraft(next, nodeId);
  }
  return next;
}
