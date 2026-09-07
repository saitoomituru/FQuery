import type { Component, ComputedRef, InjectionKey } from "vue";
import type { FQueryUiEvent, NodeViewModel, PresentationProjection } from "@fquery/ui-core";

/**
 * canvas上のnode本体（content interface）が参照する投影情報。
 * FQueryBaklavaViewがprovideし、FQueryCanvasNodeContentがinjectする。
 * Baklava graph objectはcanonicalではないので、modelはnodeIdで引き直す。
 */
export interface CanvasContext {
  readonly modelById: ComputedRef<ReadonlyMap<string, NodeViewModel>>;
  readonly presentations: ComputedRef<Readonly<Record<string, PresentationProjection>>>;
  readonly renderers: ComputedRef<Readonly<Record<string, Component>>>;
  readonly emit: (event: FQueryUiEvent) => void;
}

export const canvasContextKey: InjectionKey<CanvasContext> = Symbol("fquery.canvas-context");

/** node本体を運ぶ非port interfaceのkey。portではないので接続対象にならない。 */
export const CONTENT_INTERFACE_KEY = "__fquery_content";
