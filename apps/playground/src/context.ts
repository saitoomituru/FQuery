import type { InjectionKey, Ref } from "vue";

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
