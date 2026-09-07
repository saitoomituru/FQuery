import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  Background,
  ReactFlow,
  applyNodeChanges,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import { selectionEquals, type ConnectionViewModel, type FQueryUiEvent, type LayoutValue, type NodeSelection, type NodeViewModel, type PresentationDecision, type PresentationProjection } from "@fquery/ui-core";
import { CanvasContext, type CanvasContextValue, type NodeRendererMap } from "./canvas-context.js";
import { FQueryFlowNode } from "./FQueryFlowNode.js";
import type { PresentationCanvasHandle } from "./model/canvas-handle.js";
import { EMPTY_DRAFT_LAYOUT, clearDraft, markDraftRequested, reconcileDraft, setDraftPosition, type DraftLayoutState } from "./model/draft-layout.js";
import { projectFlow } from "./model/flow-projection.js";
import { GuiRequestFactory } from "./model/gui-requests.js";

export interface FQueryFlowViewProps {
  readonly nodes: readonly NodeViewModel[];
  readonly connections?: readonly ConnectionViewModel[] | undefined;
  readonly layout?: readonly LayoutValue[] | undefined;
  /** sessionのdecision履歴。drag中の暫定座標を破棄する契機にだけ使い、意味判定には使わない */
  readonly decisions?: readonly PresentationDecision[] | undefined;
  readonly presentations?: Readonly<Record<string, PresentationProjection>> | undefined;
  readonly nodeRenderers?: NodeRendererMap | undefined;
  /** sessionのselection。正本はsession側で、canvas側の選択はrequestへ変換する */
  readonly selection?: NodeSelection | undefined;
  readonly onEvent: (event: FQueryUiEvent) => void;
  readonly requestPrefix?: string | undefined;
}

const NODE_TYPES = { fquery: FQueryFlowNode };
const EMPTY_SELECTION: NodeSelection = Object.freeze({ nodeIds: Object.freeze([]) });
const EMPTY_LAYOUT: readonly LayoutValue[] = Object.freeze([]);
const EMPTY_DECISIONS: readonly PresentationDecision[] = Object.freeze([]);

/**
 * React Flowをgraph presentation surfaceとして使うview。
 * node position／edge端点／pan／zoom／selection／dragはReact Flowが所有し、
 * FQuery側はsession stateの一方向投影とgesture→requestの変換だけを行う。
 */
export const FQueryFlowView = forwardRef<PresentationCanvasHandle, FQueryFlowViewProps>(function FQueryFlowView(props, ref) {
  return (
    <ReactFlowProvider>
      <FlowSurface {...props} handleRef={ref} />
    </ReactFlowProvider>
  );
});

type SurfaceProps = FQueryFlowViewProps & { readonly handleRef: React.ForwardedRef<PresentationCanvasHandle> };

function FlowSurface({ nodes, connections, layout, decisions, presentations, nodeRenderers, selection, onEvent, requestPrefix, handleRef }: SurfaceProps) {
  const flow = useReactFlow();
  const rootRef = useRef<HTMLElement>(null);
  const factory = useMemo(() => new GuiRequestFactory(requestPrefix ?? "ui"), [requestPrefix]);
  const acceptedLayout = layout ?? EMPTY_LAYOUT;
  const decisionHistory = decisions ?? EMPTY_DECISIONS;
  const currentSelection = selection ?? EMPTY_SELECTION;
  const draftRef = useRef<DraftLayoutState>(EMPTY_DRAFT_LAYOUT);

  // sessionから導いた投影。drag中はReact Flowのchangeを差分適用するだけで、全nodeを作り直さない
  const projection = useMemo(() => projectFlow({
    nodes,
    connections: connections ?? [],
    layout: acceptedLayout,
    selection: currentSelection,
  }), [nodes, connections, acceptedLayout, currentSelection]);

  const [flowNodes, setFlowNodes] = useState<Node[]>([]);
  useEffect(() => {
    // decisionが届いた暫定座標は捨てる。rejected時の位置復帰はaccepted layoutの再投影だけで起きる
    draftRef.current = reconcileDraft(draftRef.current, decisionHistory, acceptedLayout);
    const pending = draftRef.current;
    setFlowNodes((previous) => {
      const previousById = new Map(previous.map((node) => [node.id, node]));
      return projection.nodes.map((node): Node => {
        const before = previousById.get(node.id);
        // drag中またはdecision待ちのnodeは、sessionの再投影で座標を巻き戻さない
        const keepPosition = before && (before.dragging || pending.pendingRequests.has(node.id));
        const position = keepPosition ? before.position : { x: node.position.x, y: node.position.y };
        if (before && before.position.x === position.x && before.position.y === position.y && before.selected === node.selected && before.className === (node.unplaced ? "fquery-flow-node-unplaced" : undefined)) {
          return before;
        }
        return {
          id: node.id,
          type: node.type,
          position,
          selected: node.selected,
          data: before?.data ?? { ...node.data },
          ...(before?.dragging ? { dragging: true } : {}),
          ...(node.unplaced ? { className: "fquery-flow-node-unplaced" } : {}),
        };
      });
    });
  }, [projection, decisionHistory, acceptedLayout]);

  const flowEdges = useMemo<Edge[]>(() => projection.edges.map((edge) => ({ ...edge })), [projection]);

  const contextValue = useMemo<CanvasContextValue>(() => ({
    modelById: new Map(nodes.map((node) => [node.nodeId, node])),
    presentations: presentations ?? {},
    renderers: nodeRenderers ?? {},
    emit: onEvent,
  }), [nodes, presentations, nodeRenderers, onEvent]);

  // React Flowのchangeは描画cacheへ差分適用する（動いたnodeだけが差し替わる）。canonicalはsession側
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const applicable = changes.filter((change) => change.type !== "remove");
    if (applicable.length === 0) return;
    setFlowNodes((previous) => applyNodeChanges(applicable, previous));
    for (const change of applicable) {
      if (change.type === "position" && change.position) draftRef.current = setDraftPosition(draftRef.current, change.id, change.position);
    }
  }, []);

  const onNodeDragStop = useCallback((_event: unknown, node: Node) => {
    const model = nodes.find((candidate) => candidate.nodeId === node.id);
    const request = model ? factory.move(model, Math.round(node.position.x), Math.round(node.position.y), presentations?.[node.id]) : undefined;
    if (!request) {
      // layoutSlotRefが無いnodeはwrite-backできないので、accepted位置へ戻す
      draftRef.current = clearDraft(draftRef.current, node.id);
      const accepted = acceptedLayout.find((value) => value.nodeId === node.id);
      if (accepted) setFlowNodes((previous) => previous.map((entry) => entry.id === node.id ? { ...entry, position: { x: accepted.x, y: accepted.y }, dragging: false } : entry));
      return;
    }
    draftRef.current = markDraftRequested(draftRef.current, node.id, request.requestId);
    onEvent(request);
  }, [nodes, presentations, acceptedLayout, factory, onEvent]);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.sourceHandle || !connection.targetHandle) return;
    onEvent(factory.connect(connection.sourceHandle, connection.targetHandle));
  }, [factory, onEvent]);

  const onSelectionChange = useCallback(({ nodes: selectedNodes }: OnSelectionChangeParams) => {
    const nodeIds = selectedNodes.map((node) => node.id);
    const active = nodeIds.at(-1);
    const next: NodeSelection = { nodeIds, ...(active ? { activeNodeId: active } : {}) };
    if (selectionEquals(next, currentSelection)) return;
    onEvent(factory.select(next));
  }, [currentSelection, factory, onEvent]);

  useImperativeHandle(handleRef, (): PresentationCanvasHandle => ({
    viewportCenter() {
      const rect = rootRef.current?.getBoundingClientRect();
      const width = rect?.width || 1200;
      const height = rect?.height || 700;
      const left = rect?.left ?? 0;
      const top = rect?.top ?? 0;
      return flow.screenToFlowPosition({ x: left + width / 2, y: top + height / 2 });
    },
    zoomToFit() {
      try {
        void flow.fitView({ padding: 0.2 });
        return true;
      } catch {
        return false;
      }
    },
    focusNode(nodeId: string) {
      if (!nodes.some((node) => node.nodeId === nodeId)) return false;
      try {
        void flow.fitView({ nodes: [{ id: nodeId }], padding: 0.4, duration: 200 });
        return true;
      } catch {
        return false;
      }
    },
  }), [flow, nodes]);

  return (
    <CanvasContext.Provider value={contextValue}>
      <section ref={rootRef} className="fquery-flow" aria-label="FQuery React Flow presentation">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={NODE_TYPES}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          // edgeの削除・再接続はGUIで確定させない。requestへ変換する経路だけを残す
          edgesReconnectable={false}
          deleteKeyCode={null}
          nodesConnectable
          minZoom={0.2}
          maxZoom={2.5}
          fitView
        >
          <Background gap={24} />
        </ReactFlow>
      </section>
    </CanvasContext.Provider>
  );
}
