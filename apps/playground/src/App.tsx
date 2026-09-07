import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { FQueryFlowView, FQueryPane, type NodeRendererMap, type PresentationCanvasHandle } from "@fquery/ui-react";
import { CORE_RENDERER_HINT, createPaneContext, findRegistrationByPresentation, type FQueryUiEvent, type GuiEventAbi } from "@fquery/ui-core";
import { isFamJsonRecord, readAccessMapProfile, validateFamJson, type AccessMapProfile } from "@fquery/fam-core";
import { createPlaygroundSession } from "./host/session.js";
import { useCanonicalFam, useEditReceipts, useFoldLogRecords, useSessionState } from "./host/use-session.js";
import { buildCoreGraph, placeUnplacedNodes, projectDecompositionGraph, projectRecursiveDecompositionGraph, refreshDecompositionNodes, type CoreNodeIds } from "./host/core-graph.js";
import { DecomposerContext, FIXTURE_ROUTE, isRecord, projectLambdaNode, projectPsiNode, requestDecompose, resultRecord, type DecomposerContextValue, type PlaygroundRoute } from "./host/decomposer.js";
import { PANE_COMPONENTS, createPlaygroundPaneRegistry } from "./host/pane-registry.js";
import { PlaygroundPaneContext, type PlaygroundEditReceiptView, type PlaygroundPaneContextValue } from "./context.js";
import { CoreNodeRenderer } from "./nodes/CoreNodeRenderer.js";
import { reprojectWithAccessMap } from "./host/causal-projection.js";
import { LocalizationContext, createLocalization, type PlaygroundLocale } from "./i18n.js";

/** rendererHint -> canvas renderer。Core 3 nodeは最初のrenderer。pluginは同じ経路で登録する。 */
const NODE_RENDERERS: NodeRendererMap = { [CORE_RENDERER_HINT]: CoreNodeRenderer };

/**
 * Playground（React）。composition rootであり、domain logicは`host/`へ置く。
 * canonical stateはsessionが持ち、React stateにはUI局所状態だけを置く。
 */
export function App() {
  const { session, receipts, fams, logs } = useMemo(() => createPlaygroundSession(), []);
  const paneRegistry = useMemo(() => createPlaygroundPaneRegistry(session.registry), [session]);
  const state = useSessionState(session);
  const editReceiptRecords = useEditReceipts(receipts);
  const canonicalDocument = useCanonicalFam(fams);
  const foldLogRecords = useFoldLogRecords(logs);
  const canvas = useRef<PresentationCanvasHandle>(null);
  const coreIds = useRef<CoreNodeIds>({});
  const accessMap = useRef<AccessMapProfile | undefined>(undefined);
  const loggedCausalRevisions = useRef(new Set<string>());
  // dev modeのStrictMode二重effectとFast Refreshのeffect再実行でCore graphを二重構築しないための同期guard
  const coreGraphBuilt = useRef(false);
  const [routes, setRoutes] = useState<readonly PlaygroundRoute[]>([FIXTURE_ROUTE]);
  const [provider, setProvider] = useState<PlaygroundRoute["provider"]>("fixture");
  const [model, setModel] = useState(FIXTURE_ROUTE.models[0] ?? "");
  const [source, setSource] = useState("雨が降っている。傘を持って出かける。ただし降水量は未確認である。");
  const [running, setRunning] = useState(false);
  const [response, setResponse] = useState<unknown>();
  const [lastEvent, setLastEvent] = useState("未実行");
  const [error, setError] = useState("");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(false);
  const [rightTab, setRightTab] = useState<string | undefined>();
  const [inspectorJump, setInspectorJump] = useState<string | null>(null);
  const [locale, setLocale] = useState<PlaygroundLocale>("ja-JP");
  const localization = useMemo(() => createLocalization(locale), [locale]);

  useEffect(() => {
    let cancelled = false;
    if (!coreGraphBuilt.current) {
      coreGraphBuilt.current = true;
      void buildCoreGraph(session).then((ids) => { coreIds.current = ids; });
    }
    void fetch("/api/routes")
      .then(async (fetched) => { if (!fetched.ok) throw new Error(`routes-http-${fetched.status}`); return await fetched.json() as readonly PlaygroundRoute[]; })
      .then((fetchedRoutes) => { if (!cancelled) setRoutes(fetchedRoutes); })
      .catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "route-discovery-failed"); });
    return () => { cancelled = true; };
  }, [session]);

  const receive = useCallback((event: FQueryUiEvent) => {
    setLastEvent(JSON.stringify(event));
    if (event.type === "focus") { canvas.current?.focusNode(event.nodeId); return; }
    if (event.type === "jump") {
      // Unsupported Data → RAW FAM。pane tabを切り替え、FAMVIMへpointerを渡す
      setInspectorJump(event.pointer);
      setRightTab("raw");
      setRightOpen(true);
      return;
    }
    if (event.type === "inspect") {
      void session.dispatch({ type: "node.select.requested", requestId: `playground:select:${Date.now()}`, nodeIds: [event.nodeId], activeNodeId: event.nodeId });
      const inspected = session.state.nodes.find((node) => node.nodeId === event.nodeId);
      setRightTab(event.nodeId === coreIds.current.famvim || Boolean(inspected?.foldRef) ? "raw" : "node");
      setRightOpen(true);
      return;
    }
    if (!isGuiRequest(event)) return;
    void session.dispatch(event).then((next) => {
      if (event.type === "node.add.requested") return placeUnplacedNodes(session, next, canvas.current?.viewportCenter() ?? { x: 400, y: 200 });
      if (event.type === "property.change.requested" && event.property === "unit.recursive-decompose" && next.decisions.at(-1)?.status === "accepted") {
        const parent = session.state.nodes.find((node) => node.nodeId === event.targetRef);
        const payload = isRecord(event.value) ? event.value : {};
        const sourceText = typeof payload.sourceText === "string" ? payload.sourceText : "";
        if (!parent?.foldRef || !sourceText) return undefined;
        const parentFoldRef = parent.foldRef;
        return requestDecompose({ provider, model, source: `なぜ: ${sourceText}` }).then(async (outcome) => {
          if (outcome.error) { setError(outcome.error); return; }
          const childValue = resultRecord(outcome.response)?.value;
          const mapperValue = isRecord(outcome.response) ? outcome.response.access_map : undefined;
          if (!isFamJsonRecord(childValue)) { setError("recursive-decomposition-fam-not-provided"); return; }
          const mapper = isFamJsonRecord(mapperValue) ? readAccessMapProfile(mapperValue) : accessMap.current;
          if (!mapper) { setError("recursive-access-map-not-provided"); return; }
          fams.add(childValue);
          const children = await projectRecursiveDecompositionGraph(session, parent.nodeId, childValue, mapper);
          const q = childValue.Q as Record<string, unknown>;
          logs.append({
            traceId: `foldlog://playground/${fams.current?.value.fam_id ?? childValue.fam_id}`,
            parentEventId: logs.last()?.eventId ?? null,
            operation: "recursive-decompose",
            sourceFoldRef: parentFoldRef,
            affectedFoldRefs: children.flatMap((nodeId) => session.state.nodes.find((node) => node.nodeId === nodeId)?.foldRef ?? []),
            sourceFamRef: fams.current?.value.fam_id ?? childValue.fam_id,
            sourceRevisionRef: fams.current?.value.revision_id ?? childValue.revision_id,
            resultFamRef: childValue.fam_id,
            resultRevisionRef: childValue.revision_id,
            accessMapFamRef: mapper.famId,
            accessMapRevisionRef: mapper.revisionId,
            registryRef: typeof q.registry_ref === "string" ? q.registry_ref : mapper.registryRef,
            roles: { observerRef: "observer://playground/user", recorderRef: "recorder://fquery/playground/foldlog", initiatorRef: "observer://playground/user", executorRef: `executor://fquery/provider/${provider}`, transformerRef: "transformer://fquery/recursive-why", causalContributorRefs: [parentFoldRef] },
            semanticStatus: "unknown",
            projectionStatus: "fresh",
            cancelledEdgeRefs: [], selectedBranchRefs: [], recompositionRequired: false,
            detail: { promptKind: "recursive-why", persistenceBoundary: "volatile-browser-memory" },
          });
        });
      }
      return undefined;
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "session-dispatch-failed"));
  }, [session, fams, logs, provider, model]);

  const execute = useCallback(async () => {
    setRunning(true);
    setError("");
    setResponse(undefined);
    projectPsiNode(session, coreIds.current, { response: undefined, running: true, source, provider, model });
    const outcome = await requestDecompose({ provider, model, source });
    if (outcome.error) setError(outcome.error);
    setResponse(outcome.response);
    if (isRecord(outcome.response) && Array.isArray(outcome.response.events)) setLastEvent(JSON.stringify(outcome.response.events.at(-1) ?? "完了"));
    projectPsiNode(session, coreIds.current, { response: outcome.response, running: false, source, provider, model });
    const famValue = resultRecord(outcome.response)?.value;
    const accessMapValue = isRecord(outcome.response) ? outcome.response.access_map : undefined;
    if (isFamJsonRecord(famValue) && isFamJsonRecord(accessMapValue)) {
      accessMap.current = readAccessMapProfile(accessMapValue);
      fams.set(famValue);
      coreIds.current = await projectDecompositionGraph(session, coreIds.current, famValue, accessMap.current);
      const reprojection = reprojectWithAccessMap(famValue, accessMap.current);
      refreshDecompositionNodes(session, coreIds.current, famValue, accessMap.current, reprojection);
      projectLambdaNode(session, coreIds.current, famValue, reprojection?.projectionStatus ?? "fresh", reprojection?.manifestations);
      const q = famValue.Q as Record<string, unknown>;
      logs.append({
        traceId: `foldlog://playground/${famValue.fam_id}`,
        parentEventId: logs.last()?.eventId ?? null,
        operation: "decompose",
        sourceFoldRef: famValue.fam_id,
        affectedFoldRefs: coreIds.current.gradients?.flatMap((nodeId) => session.state.nodes.find((node) => node.nodeId === nodeId)?.foldRef ?? []) ?? [],
        sourceFamRef: famValue.fam_id,
        sourceRevisionRef: famValue.revision_id,
        resultFamRef: famValue.fam_id,
        resultRevisionRef: famValue.revision_id,
        accessMapFamRef: accessMap.current.famId,
        accessMapRevisionRef: accessMap.current.revisionId,
        registryRef: typeof q.registry_ref === "string" ? q.registry_ref : accessMap.current.registryRef,
        roles: { observerRef: "observer://playground/user", recorderRef: "recorder://fquery/playground/foldlog", initiatorRef: "observer://playground/user", executorRef: `executor://fquery/provider/${provider}`, transformerRef: "transformer://fquery/fam-decompose", causalContributorRefs: [] },
        semanticStatus: String(resultRecord(outcome.response)?.semantic_status ?? "unknown"),
        projectionStatus: "fresh",
        cancelledEdgeRefs: [], selectedBranchRefs: [], recompositionRequired: false,
        detail: { provider, model, persistenceBoundary: "volatile-browser-memory", oaeManagementSystem: false },
      });
    }
    setRunning(false);
  }, [session, fams, logs, source, provider, model]);

  const decomposer = useMemo<DecomposerContextValue>(() => ({
    routes, provider, model, source, running,
    setProvider: (next) => { setProvider(next); setModel(routes.find((route) => route.provider === next)?.models[0] ?? ""); setResponse(undefined); setError(""); },
    setModel, setSource, execute,
  }), [routes, provider, model, source, running, execute]);

  // Host責務: ∇φ.FAMVIMのcanonical FAMが変わったら、接続先λ.NLへmanifestationをfixture projectionとして投影する（λ判定はしない）
  const fam = canonicalDocument?.value;
  useEffect(() => {
    if (!fam || !accessMap.current) return;
    const reprojection = reprojectWithAccessMap(fam, accessMap.current);
    refreshDecompositionNodes(session, coreIds.current, fam, accessMap.current, reprojection);
    projectLambdaNode(session, coreIds.current, fam, reprojection?.projectionStatus ?? "fresh", reprojection?.manifestations);
    if (reprojection && !loggedCausalRevisions.current.has(fam.revision_id)) {
      loggedCausalRevisions.current.add(fam.revision_id);
      const q = fam.Q as Record<string, unknown>;
      logs.append({
        traceId: `foldlog://playground/${fam.fam_id}`,
        parentEventId: logs.last()?.eventId ?? null,
        operation: "validate-edge",
        sourceFoldRef: reprojection.affectedFoldRefs[0] ?? fam.fam_id,
        affectedFoldRefs: reprojection.affectedFoldRefs,
        sourceFamRef: fam.fam_id,
        sourceRevisionRef: fam.revision_id,
        resultFamRef: fam.fam_id,
        resultRevisionRef: fam.revision_id,
        accessMapFamRef: accessMap.current.famId,
        accessMapRevisionRef: accessMap.current.revisionId,
        registryRef: typeof q.registry_ref === "string" ? q.registry_ref : accessMap.current.registryRef,
        roles: { observerRef: "observer://playground/user", recorderRef: "recorder://fquery/playground/foldlog", executorRef: "executor://fquery/core/fold-reprojection", transformerRef: "transformer://fquery/access-map-adapter", causalContributorRefs: reprojection.affectedFoldRefs },
        semanticStatus: reprojection.stale ? "recomposition-required" : "fixture-rule-retained",
        projectionStatus: reprojection.projectionStatus,
        cancelledEdgeRefs: reprojection.cancelledGateRefs,
        selectedBranchRefs: reprojection.selectedFallbackRefs,
        recompositionRequired: reprojection.stale,
        detail: { edgeEvaluations: reprojection.edgeEvaluations, persistenceBoundary: "volatile-browser-memory", conditionAuthority: "fixture-access-map" },
      });
    }
  }, [session, logs, fam]);

  const psiNode = state.nodes.find((node) => node.nodeId === coreIds.current.psi);
  /** active cursor nodeはsessionのselection。未選択時はΨ.NLを既定にする */
  const selectedNode = state.nodes.find((node) => node.nodeId === state.selection.activeNodeId) ?? psiNode;
  const selectedProjection = selectedNode ? state.presentations[selectedNode.nodeId] : undefined;
  const registrations = session.registry.registrations();
  const selectedRegistration = findRegistrationByPresentation(session.registry, selectedProjection?.presentation?.presentationId);
  const paneContext = useMemo(() => createPaneContext({
    selection: selectedNode ? { nodeIds: state.selection.nodeIds.length ? state.selection.nodeIds : [selectedNode.nodeId], activeNodeId: selectedNode.nodeId } : state.selection,
    nodes: state.nodes,
    presentations: state.presentations,
    registrations,
  }), [state, selectedNode, registrations]);
  const leftTabs = useMemo(() => paneRegistry.resolve("left", paneContext), [paneRegistry, paneContext]);
  const rightTabs = useMemo(() => paneRegistry.resolve("right", paneContext), [paneRegistry, paneContext]);

  const record = resultRecord(response);
  const semanticProjection = isRecord(record?.value) && typeof record.value.schema_version === "string" && record.value.schema_version.startsWith("fquery.semantic-block-projection/") ? record.value : undefined;
  const providerReceipt = record ? { transport_status: record.transport_status, plugin_status: record.plugin_status, execution: record.execution, evidence_refs: record.evidence_refs } : undefined;
  const debugEvents = isRecord(response) && Array.isArray(response.events) ? response.events : undefined;
  const editReceipts = useMemo<readonly PlaygroundEditReceiptView[]>(() => editReceiptRecords.map((receipt) => ({
    status: receipt.status,
    operationId: receipt.operationId,
    baseRevisionId: receipt.baseRevisionId,
    resultRevisionId: receipt.resultRevisionId,
    patchCount: receipt.patches.length,
    validationIssueCount: receipt.validationIssues.length,
    ...(receipt.reason ? { reason: receipt.reason } : {}),
    losses: receipt.losses,
    sourceMutation: receipt.sourceMutation,
    beforeSha256: receipt.beforeSha256,
    afterSha256: receipt.afterSha256,
  })), [editReceiptRecords]);

  const paneHost = useMemo<PlaygroundPaneContextValue>(() => ({
    sessionState: state, registrations, fam, semanticProjection, providerReceipt, debugEvents, famLog: foldLogRecords, editReceipts,
    selectedRegistration, selectedProjection, inspectorJump, validate: validateFamJson, receive,
  }), [state, registrations, fam, semanticProjection, providerReceipt, debugEvents, foldLogRecords, editReceipts, selectedRegistration, selectedProjection, inspectorJump, receive]);

  /** Blender流: T=左Tool pane、N=右Inspector pane、Home=Frame all。入力中は無効。 */
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
    if (event.key === "t" || event.key === "T") { setLeftOpen((open) => !open); event.preventDefault(); }
    if (event.key === "n" || event.key === "N") { setRightOpen((open) => !open); event.preventDefault(); }
    if (event.key === "Home") { canvas.current?.zoomToFit(); event.preventDefault(); }
  }

  return (
    <LocalizationContext.Provider value={localization}>
    <DecomposerContext.Provider value={decomposer}>
      <PlaygroundPaneContext.Provider value={paneHost}>
        <div className="shell" tabIndex={-1} onKeyDown={onKeyDown}>
          <header className="topbar">
            <button type="button" className="hamburger" aria-pressed={leftOpen} aria-label="toggle tool pane (T)" title="Tool pane (T)" onClick={() => setLeftOpen((open) => !open)}>☰</button>
            <div>
              <p className="eyebrow">FQUERY NODE EDITOR · REACT FLOW</p>
              <h1>{localization.t("app.title")}</h1>
            </div>
            <output aria-live="polite">{localization.t("app.lastEvent")}: {lastEvent}</output>
            <span className="spacer" />
            <label>locale <select aria-label="locale" value={locale} onChange={(event) => setLocale(event.target.value as PlaygroundLocale)}><option value="ja-JP">日本語</option><option value="en-US">English</option></select></label>
            {error && <p className="error" role="alert">{error}</p>}
            <button type="button" title="Frame all (Home)" onClick={() => canvas.current?.zoomToFit()}>{localization.t("app.frameAll")}</button>
            <button type="button" className="hamburger" aria-pressed={rightOpen} aria-label="toggle inspector pane (N)" title="Inspector pane (N)" onClick={() => setRightOpen((open) => !open)}>☰</button>
          </header>
          <main className="stage" aria-label="node editor">
            <div className="overlay-left">
              <FQueryPane side="left" storageKey="fquery.playground" tabs={leftTabs} components={PANE_COMPONENTS} context={paneContext} open={leftOpen} onEvent={receive} onOpenChange={setLeftOpen} />
            </div>
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
            <div className="overlay-right">
              <FQueryPane side="right" storageKey="fquery.playground" tabs={rightTabs} components={PANE_COMPONENTS} context={paneContext} open={rightOpen} activeTab={rightTab} onEvent={receive} onOpenChange={setRightOpen} onActiveTabChange={setRightTab} />
            </div>
          </main>
        </div>
      </PlaygroundPaneContext.Provider>
    </DecomposerContext.Provider>
    </LocalizationContext.Provider>
  );
}

function isGuiRequest(event: FQueryUiEvent): event is GuiEventAbi {
  return event.type.endsWith(".requested") || event.type.startsWith("plugin.presentation.");
}
