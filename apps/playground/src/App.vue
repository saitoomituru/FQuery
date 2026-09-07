<script setup lang="ts">
import { computed, onMounted, provide, ref, shallowRef, watch } from "vue";
import { FQueryBaklavaView, FQueryPane, type FQueryBaklavaViewHandle } from "@fquery/ui-vue";
import {
  PaneRegistry,
  PluginPresentationRegistry,
  PresentationSession,
  CORE_RENDERER_HINT,
  createPaneContext,
  corePortId,
  createCoreNodeViewModel,
  createFixtureDecisionPort,
  findCoreNodeContract,
  findRegistrationByPresentation,
  registerCoreNodes,
  statusTone,
  type FQueryUiEvent,
  type GuiEventAbi,
  type PresentationSessionState,
  type StatusBadgeViewModel,
} from "@fquery/ui-core";
import { isFamJsonRecord, validateFamJson } from "@fquery/fam-core";
import { applyFamPatch, openFamText, replaceFamText, serializeFamValue, type FamPatch, type FamPatchResult, type JsonValue } from "@fquery/fam-edit";
import { decomposerContextKey, playgroundPaneContextKey, type PaneComponentMap, type PlaygroundRoute } from "./context.js";
import CoreNodeRenderer from "./nodes/CoreNodeRenderer.vue";
import AddNodeSection from "./panes/AddNodeSection.vue";
import OutlinerSection from "./panes/OutlinerSection.vue";
import RecordsSection from "./panes/RecordsSection.vue";
import DecisionsSection from "./panes/DecisionsSection.vue";
import NodePanelSection from "./panes/NodePanelSection.vue";
import DecomposerSection from "./panes/DecomposerSection.vue";

type Route = PlaygroundRoute;

const routes = ref<readonly Route[]>([{ provider: "fixture", label: "Fixture", available: true, models: ["mock-fam-transformer"] }]);
const provider = ref<Route["provider"]>("fixture");
const model = ref("mock-fam-transformer");
const source = ref("雨が降っている。傘を持って出かける。ただし降水量は未確認である。");
const lastEvent = ref("未実行");
const response = ref<unknown>();
const running = ref(false);
const routeError = ref("");
const canvas = ref<FQueryBaklavaViewHandle>();
const leftOpen = ref(true);
const rightOpen = ref(false);
const inspectorTab = ref<"settings" | "connections" | "q" | "unsupported" | "raw" | undefined>();

// GUIは判定を行わない。Playgroundではengine不在のためfixture portが構造判定だけを返す。
const registry = new PluginPresentationRegistry();
registerCoreNodes(registry);
const session = new PresentationSession(createFixtureDecisionPort({
  registry,
  renderer: { rendererId: "vue-baklava", supportedHints: [CORE_RENDERER_HINT] },
  nodeIdPrefix: "q://playground/node",
  createNode: (capability, nodeId) => {
    const contract = findCoreNodeContract(capability);
    if (!contract) throw new Error(`core-contract-not-found:${capability}`);
    return createCoreNodeViewModel(contract, nodeId);
  },
  // Host責務: FAMVIM／Node Panelからのfam.patch / fam.textをcanonical valueへ適用する。GUIは適用しない。
  resolveProperty: (node, property, value) => {
    if (property !== "fam.patch" && property !== "fam.text") return undefined;
    if (node.value === null || node.value === undefined) return { rejected: "fam-not-provided" };
    const document = openFamText(serializeFamValue(node.value as JsonValue));
    const result: FamPatchResult = property === "fam.patch"
      ? applyFamPatch(document, value as FamPatch, { validate: validateFamJson })
      : replaceFamText(document, String(value), { validate: validateFamJson });
    editReceipts.value = [...editReceipts.value, result.receipt];
    if (result.receipt.status === "rejected") return { rejected: result.receipt.rejectedOperation?.reason ?? "fam-edit-rejected" };
    if (result.document.parse === "unparsed") return { rejected: `fam-text-unparsed:${result.document.parseError}` };
    const semantic = result.validation?.valid === false ? "semantic-unsatisfied" : "unknown";
    return { ...node, value: result.document.value, badges: [{ axis: "semantic", value: semantic, tone: statusTone(semantic) }], evidenceRefs: [...node.evidenceRefs, `fam-edit://${result.receipt.status}/${result.receipt.appliedOperations}`] };
  },
}), { registry });
const editReceipts = ref<readonly FamPatchResult["receipt"][]>([]);
const sessionState = shallowRef<PresentationSessionState>(session.state);
session.subscribe((state) => { sessionState.value = state; });
const registrations = computed(() => session.registry.registrations());
const coreNodeIds = ref<{ psi?: string | undefined; famvim?: string | undefined; lambda?: string | undefined }>({});
let selectSequence = 0;

/** rendererHint -> canvas renderer。Core 3 nodeは最初のrenderer。pluginは同じ経路で自分のrendererを登録する。 */
const nodeRenderers = { [CORE_RENDERER_HINT]: CoreNodeRenderer };

provide(decomposerContextKey, { routes, provider, model, source, running, execute });

/**
 * pane contribution（Issue #33）。左=Tool（Add Node / Records / Decisions）、右=Inspector。
 * Coreのnode panelとHostのdecomposer sectionを同じregistryへ宣言し、pluginは
 * registration.editor.panesで同じ経路へ参加する。
 */
const paneRegistry = new PaneRegistry();
paneRegistry.register({ side: "left", tab: { id: "add", title: "Add Node", icon: "＋", order: 0 }, section: { id: "palette", title: "検索して追加", order: 0 }, componentRef: "host:add-node", source: "host" });
paneRegistry.register({ side: "left", tab: { id: "outline", title: "階層", icon: "☷", order: 10 }, section: { id: "outliner", title: "Nodes", order: 0 }, componentRef: "host:outliner", source: "host" });
paneRegistry.register({ side: "left", tab: { id: "records", title: "Records", icon: "▤", order: 20 }, section: { id: "records", title: "FAM / projection / FAMLog / receipt / debug", order: 0 }, componentRef: "host:records", source: "host" });
paneRegistry.register({ side: "left", tab: { id: "decisions", title: "Decisions", icon: "≡", order: 30 }, section: { id: "decisions", title: "Session decisions / FAM edit receipts", order: 0 }, componentRef: "host:decisions", source: "host" });
paneRegistry.register({ side: "right", tab: { id: "node", title: "Node", icon: "◈", order: 0 }, section: { id: "node-panel", title: "Node panel", order: 10 }, componentRef: "core:node-panel", source: "core", applies: (context) => context.activeNode !== undefined });
paneRegistry.register({ side: "right", tab: { id: "node", title: "Node", icon: "◈", order: 0 }, section: { id: "decomposer", title: "Ψ.NL decomposer route", order: 0 }, componentRef: "host:decomposer", source: "host", applies: (context) => context.famRole === "ψ" });
for (const registration of registry.registrations()) paneRegistry.registerPlugin(registration);
const paneComponents: PaneComponentMap = {
  "host:add-node": AddNodeSection,
  "host:outliner": OutlinerSection,
  "host:records": RecordsSection,
  "host:decisions": DecisionsSection,
  "core:node-panel": NodePanelSection,
  "host:decomposer": DecomposerSection,
};

const selectedRoute = computed(() => routes.value.find((route) => route.provider === provider.value));
const resultRecord = computed<Record<string, unknown> | undefined>(() => {
  if (!isRecord(response.value) || !isRecord(response.value.result)) return undefined;
  return response.value.result;
});
const responseFam = computed(() => isFamJsonRecord(resultRecord.value?.value) ? resultRecord.value?.value : undefined);
const famvimNode = computed(() => sessionState.value.nodes.find((node) => node.nodeId === coreNodeIds.value.famvim));
/** canonical FAMは∇φ.FAMVIM nodeが保持するvalue。provider responseはその初期投影に過ぎない。 */
const fam = computed<unknown>(() => famvimNode.value?.value ?? undefined);
const psiNode = computed(() => sessionState.value.nodes.find((node) => node.nodeId === coreNodeIds.value.psi));
/** active cursor nodeはsessionのselection。未選択時はΨ.NLを既定にする */
const selectedNode = computed(() => sessionState.value.nodes.find((node) => node.nodeId === sessionState.value.selection.activeNodeId) ?? psiNode.value);
const selectedProjection = computed(() => selectedNode.value ? sessionState.value.presentations[selectedNode.value.nodeId] : undefined);
const selectedRegistration = computed(() => findRegistrationByPresentation(session.registry, selectedProjection.value?.presentation?.presentationId));
const paneContext = computed(() => createPaneContext({
  selection: selectedNode.value ? { nodeIds: sessionState.value.selection.nodeIds.length ? sessionState.value.selection.nodeIds : [selectedNode.value.nodeId], activeNodeId: selectedNode.value.nodeId } : sessionState.value.selection,
  nodes: sessionState.value.nodes,
  presentations: sessionState.value.presentations,
  registrations: registrations.value,
}));
const leftTabs = computed(() => paneRegistry.resolve("left", paneContext.value));
const rightTabs = computed(() => paneRegistry.resolve("right", paneContext.value));
const semanticProjection = computed(() => {
  const value = resultRecord.value?.value;
  return isRecord(value) && typeof value.schema_version === "string" && value.schema_version.startsWith("fquery.semantic-block-projection/") ? value : undefined;
});
const providerReceipt = computed(() => resultRecord.value ? {
  transport_status: resultRecord.value.transport_status,
  plugin_status: resultRecord.value.plugin_status,
  execution: resultRecord.value.execution,
  evidence_refs: resultRecord.value.evidence_refs,
} : undefined);
const debugEvents = computed(() => isRecord(response.value) && Array.isArray(response.value.events) ? response.value.events : undefined);

provide(playgroundPaneContextKey, { sessionState, registrations, fam, semanticProjection, providerReceipt, debugEvents, editReceipts, selectedRegistration, selectedProjection, inspectorTab, validate: validateFamJson, receive });

/** Blender流: T=左Tool pane、N=右Inspector pane。入力中は無効。 */
function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
  if (event.key === "t" || event.key === "T") { leftOpen.value = !leftOpen.value; event.preventDefault(); }
  if (event.key === "n" || event.key === "N") { rightOpen.value = !rightOpen.value; event.preventDefault(); }
  if (event.key === "Home") { frameAll(); event.preventDefault(); }
}

watch(provider, () => { model.value = selectedRoute.value?.models[0] ?? ""; response.value = undefined; routeError.value = ""; });
// Host責務: ∇φ.FAMVIMのcanonical FAMが変わったら、接続先λ.NLへmanifestationをfixture projectionとして投影する（λ判定はしない）
watch(fam, (value) => projectLambdaNode(value));

onMounted(async () => {
  await buildCoreGraph();
  try {
    const fetched = await fetch("/api/routes");
    if (!fetched.ok) throw new Error(`routes-http-${fetched.status}`);
    routes.value = await fetched.json() as readonly Route[];
  } catch (error) {
    routeError.value = error instanceof Error ? error.message : "route-discovery-failed";
  }
});

/** Core 3 nodeをpluginなしで構築する。接続の可否はportへ委譲する。 */
async function buildCoreGraph() {
  const psi = await addCoreNode("core.psi.nl-input", 1);
  const famvim = await addCoreNode("core.gradient.famvim", 2);
  const lambda = await addCoreNode("core.lambda.nl-output", 3);
  coreNodeIds.value = { psi, famvim, lambda };
  if (psi && famvim) await session.dispatch({ type: "connection.add.requested", requestId: "playground:connect:psi-famvim", fromPortId: corePortId(psi, "observation"), toPortId: corePortId(famvim, "psi") });
  if (famvim && lambda) await session.dispatch({ type: "connection.add.requested", requestId: "playground:connect:famvim-lambda", fromPortId: corePortId(famvim, "fam"), toPortId: corePortId(lambda, "fam") });
  const positions = [psi, famvim, lambda].map((nodeId, index) => ({ nodeId, x: 320 + index * 380, y: 120 }));
  for (const position of positions) {
    if (!position.nodeId) continue;
    await session.dispatch({ type: "node.move.requested", requestId: `playground:layout:${position.nodeId}`, nodeId: position.nodeId, layoutSlotRef: `layout://playground/${position.nodeId}`, x: position.x, y: position.y });
  }
}

async function addCoreNode(capability: string, sequence: number): Promise<string | undefined> {
  const state = await session.dispatch({ type: "node.add.requested", requestId: `playground:add:${sequence}`, capability });
  const decision = state.decisions.at(-1);
  return decision?.kind === "node.add" && decision.status === "accepted" ? decision.node?.nodeId : undefined;
}

function receive(event: FQueryUiEvent) {
  lastEvent.value = JSON.stringify(event);
  if (event.type === "focus") { canvas.value?.focusNode(event.nodeId); return; }
  if (event.type === "inspect") {
    selectSequence += 1;
    void session.dispatch({ type: "node.select.requested", requestId: `playground:select:${selectSequence}`, nodeIds: [event.nodeId], activeNodeId: event.nodeId });
    inspectorTab.value = event.nodeId === coreNodeIds.value.famvim ? "raw" : "settings";
    rightOpen.value = true;
    return;
  }
  if (isGuiRequest(event)) {
    void session.dispatch(event).then((state) => {
      if (event.type === "node.add.requested") void placeUnplacedNodes(state);
    }).catch((error: unknown) => { routeError.value = error instanceof Error ? error.message : "session-dispatch-failed"; });
  }
}

let placementSequence = 0;
/**
 * Host責務: acceptされたlayoutが無いnodeをviewport中央へ置く。複数あれば縦へずらす。
 * 位置はPresentation FAMではなくlayout write-backとしてsessionへ通す。
 */
async function placeUnplacedNodes(state: PresentationSessionState) {
  const placed = new Set(state.layout.map((entry) => entry.nodeId));
  const unplaced = state.nodes.filter((node) => !placed.has(node.nodeId));
  if (unplaced.length === 0) return;
  const center = canvas.value?.viewportCenter() ?? { x: 400, y: 200 };
  for (const [index, node] of unplaced.entries()) {
    placementSequence += 1;
    await session.dispatch({
      type: "node.move.requested",
      requestId: `playground:place:${placementSequence}`,
      nodeId: node.nodeId,
      layoutSlotRef: `layout://playground/${node.nodeId}`,
      x: Math.round(center.x - 160),
      y: Math.round(center.y - 60 + index * 140),
    });
  }
}

function frameAll() { canvas.value?.zoomToFit(); }

async function execute() {
  running.value = true;
  response.value = undefined;
  routeError.value = "";
  projectPsiNode({ running: true });
  try {
    const fetched = await fetch("/api/decompose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider: provider.value, model: model.value, source: source.value }) });
    const payload: unknown = await fetched.json();
    if (!fetched.ok) throw new Error(isRecord(payload) && typeof payload.error === "string" ? payload.error : `decompose-http-${fetched.status}`);
    response.value = payload;
    if (isRecord(payload) && Array.isArray(payload.events)) lastEvent.value = JSON.stringify(payload.events.at(-1) ?? "完了");
    projectPsiNode({ running: false });
    projectFamvimNode();
  } catch (error) {
    routeError.value = error instanceof Error ? error.message : "decompose-failed";
    projectPsiNode({ running: false });
  } finally {
    running.value = false;
  }
}

/** engineが返したQueryResultをΨ.NL nodeへ投影する。GUIはstatusを再計算しない。 */
function projectPsiNode(options: { running: boolean }) {
  const node = psiNode.value;
  if (!node) return;
  const record = resultRecord.value;
  const badges: StatusBadgeViewModel[] = (["resolution", "connection", "transport", "plugin", "semantic", "lambda", "control"] as const).map((axis) => {
    const raw = record?.[`${axis}_status`];
    const value = options.running && axis === "plugin" ? "running" : typeof raw === "string" ? raw : axis === "semantic" || axis === "lambda" ? "unknown" : "not-requested";
    return { axis, value, tone: statusTone(value) };
  });
  session.applyEngineEvent({ type: "fam.node.changed", node: { ...node, badges, value: { source_text: source.value, provider: provider.value, model: model.value }, canExecute: false } });
}

/** 分解結果FAMを∇φ.FAMVIM nodeのvalueへ投影する。正本はこのnodeのvalueであり、records paneは複製表示。 */
function projectFamvimNode() {
  const node = famvimNode.value;
  if (!node) return;
  const semantic = responseFam.value ? "unknown" : "not-evaluated";
  session.applyEngineEvent({ type: "fam.node.changed", node: { ...node, badges: [{ axis: "semantic", value: semantic, tone: statusTone(semantic) }], value: responseFam.value ?? null } });
}

/** λ.NLへmanifestationを投影する。fixture projectionであり、λ satisfactionは`unknown`のまま。 */
function projectLambdaNode(value: unknown) {
  const nodeId = coreNodeIds.value.lambda;
  const node = nodeId ? sessionState.value.nodes.find((entry) => entry.nodeId === nodeId) : undefined;
  if (!node) return;
  const connected = sessionState.value.connections.some((connection) => connection.toPortId === corePortId(node.nodeId, "fam"));
  const lambda = isRecord(value) && isRecord(value.λ) ? value.λ : undefined;
  const units = lambda && Array.isArray(lambda.output_units) ? lambda.output_units : [];
  const manifestations = units.map((unit) => isRecord(unit) && isRecord(unit.λ) && typeof unit.λ.manifestation === "string" ? unit.λ.manifestation : "").filter(Boolean);
  const projected = connected && manifestations.length > 0;
  session.applyEngineEvent({
    type: "fam.node.changed",
    node: {
      ...node,
      badges: [{ axis: "lambda", value: "unknown", tone: statusTone("unknown") }],
      value: projected ? { projection_kind: "fixture-projection", manifestations } : null,
    },
  });
}

function isGuiRequest(event: FQueryUiEvent): event is GuiEventAbi {
  return event.type.endsWith(".requested") || event.type.startsWith("plugin.presentation.");
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
</script>

<template>
  <div class="shell" tabindex="-1" @keydown="onKeydown">
    <header class="topbar">
      <button type="button" class="hamburger" :aria-pressed="leftOpen ? 'true' : 'false'" aria-label="toggle tool pane (T)" title="Tool pane (T)" @click="leftOpen = !leftOpen">☰</button>
      <div>
        <p class="eyebrow">FQUERY NODE EDITOR</p>
        <h1>FQuery Playground — Ψ.NL → ∇φ.FAMVIM → λ.NL</h1>
      </div>
      <output aria-live="polite">last event: {{ lastEvent }}</output>
      <span class="spacer" />
      <p v-if="routeError" class="error" role="alert">{{ routeError }}</p>
      <button type="button" title="Frame all (Home)" @click="frameAll">Frame all</button>
      <button type="button" class="hamburger" :aria-pressed="rightOpen ? 'true' : 'false'" aria-label="toggle inspector pane (N)" title="Inspector pane (N)" @click="rightOpen = !rightOpen">☰</button>
    </header>

    <main class="stage" aria-label="node editor">
      <FQueryPane v-model:open="leftOpen" class="overlay-left" side="left" storage-key="fquery.playground" :tabs="leftTabs" :components="paneComponents" :context="paneContext" @event="receive" />
      <FQueryBaklavaView
        ref="canvas"
        fill
        :nodes="sessionState.nodes"
        :connections="sessionState.connections"
        :layout="sessionState.layout"
        :presentations="sessionState.presentations"
        :node-renderers="nodeRenderers"
        :selection="sessionState.selection"
        @event="receive"
      />
      <FQueryPane v-model:open="rightOpen" class="overlay-right" side="right" storage-key="fquery.playground" :tabs="rightTabs" :components="paneComponents" :context="paneContext" @event="receive" />
    </main>
  </div>
</template>
