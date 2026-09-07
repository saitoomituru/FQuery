<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from "vue";
import { FQueryBaklavaView, FQueryPalette, FQueryPanel, FQueryRecordsPanel } from "@fquery/ui-vue";
import {
  PluginPresentationRegistry,
  PresentationSession,
  CORE_RENDERER_HINT,
  corePortId,
  createCoreNodeViewModel,
  createFixtureDecisionPort,
  findCoreNodeContract,
  registerCoreNodes,
  statusTone,
  type FQueryUiEvent,
  type GuiEventAbi,
  type NodeViewModel,
  type PresentationSessionState,
  type StatusBadgeViewModel,
} from "@fquery/ui-core";
import { isFamJsonRecord } from "@fquery/fam-core";

interface Route { readonly provider: "fixture" | "gemini" | "ollama"; readonly label: string; readonly available: boolean; readonly models: readonly string[]; readonly credentialName?: string; readonly reason?: string }

const routes = ref<readonly Route[]>([{ provider: "fixture", label: "Fixture", available: true, models: ["mock-fam-transformer"] }]);
const provider = ref<Route["provider"]>("fixture");
const model = ref("mock-fam-transformer");
const source = ref("雨が降っている。傘を持って出かける。ただし降水量は未確認である。");
const lastEvent = ref("未実行");
const response = ref<unknown>();
const running = ref(false);
const routeError = ref("");

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
}), { registry });
const sessionState = shallowRef<PresentationSessionState>(session.state);
session.subscribe((state) => { sessionState.value = state; });
const registrations = computed(() => session.registry.registrations());
const coreNodeIds = ref<{ psi?: string | undefined; famvim?: string | undefined; lambda?: string | undefined }>({});

const selectedRoute = computed(() => routes.value.find((route) => route.provider === provider.value));
const resultRecord = computed<Record<string, unknown> | undefined>(() => {
  if (!isRecord(response.value) || !isRecord(response.value.result)) return undefined;
  return response.value.result;
});
const fam = computed(() => isFamJsonRecord(resultRecord.value?.value) ? resultRecord.value?.value : undefined);
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
  const positions = [psi, famvim, lambda].map((nodeId, index) => ({ nodeId, x: 60 + index * 320, y: 90 }));
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
  const nodeId = coreNodeIds.value.psi;
  const node = nodeId ? session.state.nodes.find((entry) => entry.nodeId === nodeId) : undefined;
  if (!node) return;
  const record = resultRecord.value;
  const badges: StatusBadgeViewModel[] = (["resolution", "connection", "transport", "plugin", "semantic", "lambda", "control"] as const).map((axis) => {
    const raw = record?.[`${axis}_status`];
    const value = options.running && axis === "plugin" ? "running" : typeof raw === "string" ? raw : axis === "semantic" || axis === "lambda" ? "unknown" : "not-requested";
    return { axis, value, tone: statusTone(value) };
  });
  session.applyEngineEvent({ type: "fam.node.changed", node: { ...node, badges, value: { source_text: source.value, provider: provider.value, model: model.value }, canExecute: false } });
}

/** 分解結果FAMを∇φ.FAMVIM nodeのvalueへ投影する。正本はrecords paneのFAMであり、node valueは表示用複製。 */
function projectFamvimNode() {
  const nodeId = coreNodeIds.value.famvim;
  const node = nodeId ? session.state.nodes.find((entry) => entry.nodeId === nodeId) : undefined;
  if (!node) return;
  const semantic = fam.value ? "unknown" : "not-evaluated";
  session.applyEngineEvent({ type: "fam.node.changed", node: { ...node, badges: [{ axis: "semantic", value: semantic, tone: statusTone(semantic) }], value: fam.value ?? null } });
}

function isGuiRequest(event: FQueryUiEvent): event is GuiEventAbi {
  return event.type.endsWith(".requested") || event.type.startsWith("plugin.presentation.");
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
</script>

<template>
  <div class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">LOCALHOST / PROVIDER ROUTES</p>
        <h1>FQuery Playground</h1>
        <p>同じfam.decomposeをfixture、Gemini、Ollamaへ交換可能に接続します。</p>
      </div>
    </header>

    <section class="controls" aria-label="route controls">
      <label>Provider
        <select v-model="provider">
          <option v-for="route in routes" :key="route.provider" :value="route.provider" :disabled="!route.available">{{ route.label }}{{ route.available ? "" : " — unavailable" }}</option>
        </select>
      </label>
      <label>Model
        <select v-model="model"><option v-for="candidate in selectedRoute?.models ?? []" :key="candidate" :value="candidate">{{ candidate }}</option></select>
      </label>
      <p class="route-note">route: {{ provider }} / {{ model }}<template v-if="selectedRoute?.credentialName"> / credential: {{ selectedRoute.credentialName }}</template></p>
      <label class="source">Natural language source<textarea v-model="source" rows="6" /></label>
      <button type="button" :disabled="running || !selectedRoute?.available || !model || !source.trim()" @click="execute">{{ running ? "推論中…" : "自然言語をFAMへ分解" }}</button>
      <p v-if="routeError" class="error" role="alert">{{ routeError }}</p>
    </section>

    <output aria-live="polite">last event: {{ lastEvent }}</output>
    <FQueryRecordsPanel
      :fam="fam"
      :semantic-projection="semanticProjection"
      :provider-receipt="providerReceipt"
      :debug-events="debugEvents"
    />
    <h2 class="surface-heading">Node editor projection</h2>
    <div class="editor-grid">
      <FQueryPalette :registrations="registrations" @event="receive" />
      <FQueryBaklavaView :nodes="sessionState.nodes" :connections="sessionState.connections" :layout="sessionState.layout" @event="receive" />
    </div>
    <section class="session-receipt" aria-label="session decisions">
      <h2 class="surface-heading">Session decisions</h2>
      <ul>
        <li v-for="decision in sessionState.decisions" :key="decision.requestId" :data-decision-status="decision.status">
          <code>{{ decision.kind }}</code> {{ decision.requestId }} → <strong>{{ decision.status }}</strong><span v-if="decision.reason"> — {{ decision.reason }}</span>
        </li>
      </ul>
    </section>
    <FQueryPanel :nodes="sessionState.nodes" @event="receive" />
  </div>
</template>
