/**
 * @baklavajs/renderer-vue 2.8.1はruntimeでexportする一部symbolを、
 * NodeNextが辿れる拡張子付きdeclarationとして公開していない。
 * FQueryが利用する最小surfaceだけをvendor境界で補う。
 */
declare module "@baklavajs/renderer-vue" {
  import type { AbstractNode, Editor } from "@baklavajs/core";
  import type { Component } from "vue";

  export const BaklavaEditor: Component;
  export interface FQueryBaklavaViewModel {
    readonly editor: Editor;
    readonly displayedGraph: { nodes: AbstractNode[]; selectedNodes: AbstractNode[] };
  }
  export function useBaklava(existingEditor?: Editor): FQueryBaklavaViewModel;
  export const Components: {
    readonly Node: Component;
    readonly NodeInterface: Component;
  };
}
