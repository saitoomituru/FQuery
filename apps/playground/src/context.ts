import type { Component, ComputedRef, InjectionKey, Ref, ShallowRef } from "vue";
import type { FQueryUiEvent, PluginPresentationRegistration, PresentationProjection, PresentationSessionState } from "@fquery/ui-core";
import type { FamPatchResult, FamValidator } from "@fquery/fam-edit";

export interface PlaygroundRoute {
  readonly provider: "fixture" | "gemini" | "ollama";
  readonly label: string;
  readonly available: boolean;
  readonly models: readonly string[];
  readonly credentialName?: string;
  readonly reason?: string;
}

/**
 * Host（Playground）がcanvas node rendererへ渡すdecomposer binding。
 * GUI Core（ui-core / ui-vue）はこの型を知らない。Ψ.NL rendererだけが使う。
 */
export interface DecomposerContext {
  readonly routes: Ref<readonly PlaygroundRoute[]>;
  readonly provider: Ref<PlaygroundRoute["provider"]>;
  readonly model: Ref<string>;
  readonly source: Ref<string>;
  readonly running: Ref<boolean>;
  readonly execute: () => Promise<void>;
}

export const decomposerContextKey: InjectionKey<DecomposerContext> = Symbol("fquery.playground.decomposer");

/** pane section componentへHostが渡す状態。GUI Coreは知らない。 */
export interface PlaygroundPaneContext {
  readonly sessionState: ShallowRef<PresentationSessionState>;
  readonly registrations: ComputedRef<readonly PluginPresentationRegistration[]>;
  readonly fam: ComputedRef<unknown>;
  readonly semanticProjection: ComputedRef<unknown>;
  readonly providerReceipt: ComputedRef<unknown>;
  readonly debugEvents: ComputedRef<unknown>;
  readonly editReceipts: ShallowRef<readonly FamPatchResult["receipt"][]>;
  readonly selectedRegistration: ComputedRef<PluginPresentationRegistration | undefined>;
  readonly selectedProjection: ComputedRef<PresentationProjection | undefined>;
  readonly inspectorTab: ShallowRef<"settings" | "connections" | "q" | "unsupported" | "raw" | undefined>;
  readonly validate: FamValidator;
  readonly receive: (event: FQueryUiEvent) => void;
}

export const playgroundPaneContextKey: InjectionKey<PlaygroundPaneContext> = Symbol("fquery.playground.pane");
export type PaneComponentMap = Readonly<Record<string, Component>>;
