import { createContext, useContext, type ComponentType } from "react";
import type { FQueryUiEvent, NodeViewModel, PresentationProjection } from "@fquery/ui-core";

export interface NodeRendererProps {
  readonly model: NodeViewModel;
  readonly projection?: PresentationProjection | undefined;
  readonly emit: (event: FQueryUiEvent) => void;
}

export type NodeRendererMap = Readonly<Record<string, ComponentType<NodeRendererProps>>>;

/**
 * canvas上のnode本体が参照する投影情報。React Flowのnode objectはcanonicalではないので、
 * modelはnodeIdで引き直す。
 */
export interface CanvasContextValue {
  readonly modelById: ReadonlyMap<string, NodeViewModel>;
  readonly presentations: Readonly<Record<string, PresentationProjection>>;
  readonly renderers: NodeRendererMap;
  readonly emit: (event: FQueryUiEvent) => void;
}

export const CanvasContext = createContext<CanvasContextValue | undefined>(undefined);

export function useCanvasContext(): CanvasContextValue | undefined {
  return useContext(CanvasContext);
}
