import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FQueryFlowView, type NodeRendererMap, type PresentationCanvasHandle } from "@fquery/ui-react";
import { CORE_RENDERER_HINT, type FQueryUiEvent, type GuiEventAbi } from "@fquery/ui-core";
import { createPlaygroundSession } from "./host/session.js";
import { useSessionState } from "./host/use-session.js";
import { buildCoreGraph, placeUnplacedNodes, type CoreNodeIds } from "./host/core-graph.js";
import { DecomposerContext, FIXTURE_ROUTE, projectFamvimNode, projectLambdaNode, projectPsiNode, requestDecompose, type DecomposerContextValue, type PlaygroundRoute } from "./host/decomposer.js";
import { CoreNodeRenderer } from "./nodes/CoreNodeRenderer.js";
import { DecisionsPanel } from "./panes/DecisionsPanel.js";
import { AddNodePanel } from "./panes/AddNodePanel.js";

/** rendererHint -> canvas renderer。Core 3 nodeは最初のrenderer。pluginは同じ経路で登録する。 */
const NODE_RENDERERS: NodeRendererMap = { [CORE_RENDERER_HINT]: CoreNodeRenderer };

/**
 * Playground（React）。composition rootであり、domain logicは`host/`へ置く。
 * canonical stateはsessionが持ち、React stateにはUI局所状態だけを置く。
 */
export function App() {
  const session = useMemo(() => createPlaygroundSession(), []);
  const state = useSessionState(session);
  const canvas = useRef<PresentationCanvasHandle>(null);
  const coreIds = useRef<CoreNodeIds>({});
  const [routes, setRoutes] = useState<readonly PlaygroundRoute[]>([FIXTURE_ROUTE]);
  const [provider, setProvider] = useState<PlaygroundRoute["provider"]>("fixture");
  const [model, setModel] = useState(FIXTURE_ROUTE.models[0] ?? "");
  const [source, setSource] = useState("雨が降っている。傘を持って出かける。ただし降水量は未確認である。");
  const [running, setRunning] = useState(false);
  const [lastEvent, setLastEvent] = useState("未実行");
  const [error, setError] = useState("");
  const [leftOpen, setLeftOpen] = useState(true);
  const [addSequence, setAddSequence] = useState(100);

  useEffect(() => {
    let cancelled = false;
    void buildCoreGraph(session).then((ids) => { if (!cancelled) coreIds.current = ids; });
    void fetch("/api/routes")
      .then(async (fetched) => { if (!fetched.ok) throw new Error(`routes-http-${fetched.status}`); return await fetched.json() as readonly PlaygroundRoute[]; })
      .then((fetchedRoutes) => { if (!cancelled) setRoutes(fetchedRoutes); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "route-discovery-failed"); });
    return () => { cancelled = true; };
  }, [session]);

  const receive = useCallback((event: FQueryUiEvent) => {
    setLastEvent(JSON.stringify(event));
    if (event.type === "focus") { canvas.current?.focusNode(event.nodeId); return; }
    if (event.type === "inspect") {
      void session.dispatch({ type: "node.select.requested", requestId: `playground:select:${Date.now()}`, nodeIds: [event.nodeId], activeNodeId: event.nodeId });
      return;
    }
    if (!isGuiRequest(event)) return;
    void session.dispatch(event).then((next) => {
      if (event.type === "node.add.requested") return placeUnplacedNodes(session, next, canvas.current?.viewportCenter() ?? { x: 400, y: 200 });
      return undefined;
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "session-dispatch-failed"));
  }, [session]);

  const execute = useCallback(async () => {
    setRunning(true);
    setError("");
    projectPsiNode(session, coreIds.current, { response: undefined, running: true, source, provider, model });
    const outcome = await requestDecompose({ provider, model, source });
    if (outcome.error) setError(outcome.error);
    projectPsiNode(session, coreIds.current, { response: outcome.response, running: false, source, provider, model });
    projectFamvimNode(session, coreIds.current, outcome.response);
    projectLambdaNode(session, coreIds.current);
    setRunning(false);
  }, [session, source, provider, model]);

  const decomposer = useMemo<DecomposerContextValue>(() => ({
    routes, provider, model, source, running,
    setProvider: (next) => { setProvider(next); setModel(routes.find((route) => route.provider === next)?.models[0] ?? ""); },
    setModel, setSource, execute,
  }), [routes, provider, model, source, running, execute]);

  const addNode = useCallback((capability: string, presentationRef: string) => {
    setAddSequence((sequence) => sequence + 1);
    receive({ type: "node.add.requested", requestId: `playground:add:${addSequence + 1}`, capability, presentationRef });
  }, [receive, addSequence]);

  return (
    <DecomposerContext.Provider value={decomposer}>
      <div className="shell">
        <header className="topbar">
          <button type="button" className="hamburger" aria-pressed={leftOpen} aria-label="toggle tool pane" onClick={() => setLeftOpen((open) => !open)}>☰</button>
          <div>
            <p className="eyebrow">FQUERY NODE EDITOR · REACT FLOW</p>
            <h1>FQuery Playground (React) — Ψ.NL → ∇φ.FAMVIM → λ.NL</h1>
          </div>
          <output aria-live="polite">last event: {lastEvent}</output>
          <span className="spacer" />
          {error && <p className="error" role="alert">{error}</p>}
          <button type="button" onClick={() => canvas.current?.zoomToFit()}>Frame all</button>
        </header>
        <main className="stage" aria-label="node editor">
          {leftOpen && (
            <aside className="overlay-left">
              <AddNodePanel registrations={session.registry.registrations()} onAdd={addNode} />
              <DecisionsPanel state={state} />
            </aside>
          )}
          <FQueryFlowView
            ref={canvas}
            nodes={state.nodes}
            connections={state.connections}
            layout={state.layout}
            decisions={state.decisions}
            presentations={state.presentations}
            nodeRenderers={NODE_RENDERERS}
            selection={state.selection}
            onEvent={receive}
            requestPrefix="ui"
          />
        </main>
      </div>
    </DecomposerContext.Provider>
  );
}

function isGuiRequest(event: FQueryUiEvent): event is GuiEventAbi {
  return event.type.endsWith(".requested") || event.type.startsWith("plugin.presentation.");
}
