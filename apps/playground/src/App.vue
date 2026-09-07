<script setup lang="ts">
import { computed, onMounted, provide, ref, shallowRef, watch } from "vue";
import { FQueryBaklavaView, FQueryNodePanel, FQueryPalette, FQueryRecordsPanel } from "@fquery/ui-vue";
import {
  PluginPresentationRegistry,
  PresentationSession,
  CORE_RENDERER_HINT,
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
import { decomposerContextKey, type PlaygroundRoute } from "./context.js";
import CoreNodeRenderer from "./nodes/CoreNodeRenderer.vue";

type Route = PlaygroundRoute;

const routes = ref<readonly Route[]>([{ provider: "fixture", label: "Fixture", available: true, models: ["mock-fam-transformer"] }]);
const provider = ref<Route["provider"]>("fixture");
const model = ref("mock-fam-transformer");
const source = ref("雨が降っている。傘を持って出かける。ただし降水量は未確認である。");
const lastEvent = ref("未実行");
const response = ref<unknown>();
const running = ref(false);
const routeError = ref("");
const inspectorOpen = ref(false);
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
  if (event.type === "inspect") {
    selectSequence += 1;
    void session.dispatch({ type: "node.select.requested", requestId: `playground:select:${selectSequence}`, nodeIds: [event.nodeId], activeNodeId: event.nodeId });
    inspectorTab.value = event.nodeId === coreNodeIds.value.famvim ? "raw" : "settings";
    inspectorOpen.value = true;
    return;
  }
  if (isGuiRequest(event)) void session.dispatch(event).catch((error: unknown) => { routeError.value = error instanceof Error ? error.message : "session-dispatch-failed"; });
}

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
  <div class="shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">FQUERY NODE EDITOR</p>
        <h1>FQuery Playground — Ψ.NL → ∇φ.FAMVIM → λ.NL</h1>
      </div>
      <output aria-live="polite">last event: {{ lastEvent }}</output>
      <span class="spacer" />
      <p v-if="routeError" class="error" role="alert">{{ routeError }}</p>
      <button type="button" :aria-pressed="inspectorOpen ? 'true' : 'false'" @click="inspectorOpen = !inspectorOpen">Inspector</button>
    </header>

    <main class="stage" aria-label="node editor">
      <FQueryBaklavaView
        fill
        :nodes="sessionState.nodes"
        :connections="sessionState.connections"
        :layout="sessionState.layout"
        :presentations="sessionState.presentations"
        :node-renderers="nodeRenderers"
        :selection="sessionState.selection"
        @event="receive"
      />
      <FQueryPalette class="overlay-palette" :registrations="registrations" @event="receive" />
      <aside class="overlay-inspector" :hidden="!inspectorOpen">
        <FQueryNodePanel
          v-if="selectedNode"
          :node="selectedNode"
          :registration="selectedRegistration"
          :projection="selectedProjection"
          :connections="sessionState.connections"
          :validate="validateFamJson"
          :tab="inspectorTab"
          @event="receive"
        />
      </aside>
    </main>

    <details class="drawer">
      <summary>Records — FAM / projection / FAMLog / receipt / debug · Session decisions（補助表示）</summary>
      <div class="drawer-grid">
        <FQueryRecordsPanel
          :fam="fam"
          :semantic-projection="semanticProjection"
          :provider-receipt="providerReceipt"
          :debug-events="debugEvents"
        />
        <div>
          <section v-if="editReceipts.length" class="session-receipt" aria-label="fam edit receipts">
            <h2>FAM edit receipts</h2>
            <ul>
              <li v-for="(receipt, index) in editReceipts" :key="index" :data-edit-status="receipt.status">
                <strong>{{ receipt.status }}</strong> ops={{ receipt.appliedOperations }} touched={{ receipt.touchedPaths.join(", ") || "-" }} retained={{ receipt.retainedUntouchedPaths }}
                <span v-if="receipt.validation"> validator={{ receipt.validation.valid ? "valid" : `${receipt.validation.issueCount} issue(s)` }}</span>
                <span v-if="receipt.rejectedOperation"> — {{ receipt.rejectedOperation.reason }}</span>
                <span v-if="receipt.loss.length"> loss={{ receipt.loss.map((entry) => entry.kind).join(",") }}</span>
              </li>
            </ul>
          </section>
          <section class="session-receipt" aria-label="session decisions">
            <h2>Session decisions</h2>
            <ul>
              <li v-for="decision in sessionState.decisions" :key="decision.requestId" :data-decision-status="decision.status">
                <code>{{ decision.kind }}</code> {{ decision.requestId }} → <strong>{{ decision.status }}</strong><span v-if="decision.reason"> — {{ decision.reason }}</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </details>
  </div>
</template>
