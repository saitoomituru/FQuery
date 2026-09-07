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
    readonly displayedGraph: { nodes: AbstractNode[]; selectedNodes: AbstractNode[]; panning: { x: number; y: number }; scaling: number };
    readonly commandHandler: { executeCommand(name: string, throwOnNonexisting?: boolean, ...args: unknown[]): unknown; canExecuteCommand(name: string): boolean };
  }
  export const ZOOM_TO_FIT_GRAPH_COMMAND: string;
  export const ZOOM_TO_FIT_NODES_COMMAND: string;
  export function useBaklava(existingEditor?: Editor): FQueryBaklavaViewModel;
  export const Components: {
    readonly Node: Component;
    readonly NodeInterface: Component;
  };
}
