<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { FQueryPanel } from "@fquery/ui-vue";
import type { FQueryUiEvent, NodeViewModel } from "@fquery/ui-core";

interface Route { readonly provider: "fixture" | "gemini" | "ollama"; readonly label: string; readonly available: boolean; readonly models: readonly string[]; readonly credentialName?: string; readonly reason?: string }

const routes = ref<readonly Route[]>([{ provider: "fixture", label: "Fixture", available: true, models: ["mock-fam-transformer"] }]);
const provider = ref<Route["provider"]>("fixture");
const model = ref("mock-fam-transformer");
const source = ref("雨が降っている。傘を持って出かける。ただし降水量は未確認である。");
const lastEvent = ref("未実行");
const response = ref<unknown>();
const running = ref(false);
const routeError = ref("");

const selectedRoute = computed(() => routes.value.find((route) => route.provider === provider.value));
const nodes = computed<readonly NodeViewModel[]>(() => [{
  nodeId: "q://playground/fam-decompose",
  label: "fam.decompose",
  badges: [
    { axis: "resolution", value: response.value ? "resolved" : "unresolved", tone: response.value ? "success" : "notice" },
    { axis: "connection", value: response.value ? "connected" : "unconnected", tone: response.value ? "success" : "notice" },
    { axis: "plugin", value: running.value ? "running" : response.value ? "resolved" : "not-requested", tone: response.value ? "success" : "notice" },
    { axis: "semantic", value: "unknown", tone: "unknown" },
  ],
  ports: [
    { portId: "source", label: "natural language", direction: "input", connectionStatus: "connected" },
    { portId: "candidate", label: "candidate FAM", direction: "output", connectionStatus: response.value ? "connected" : "unconnected" },
  ],
  value: response.value ?? null,
  evidenceRefs: [],
  canExecute: !running.value && Boolean(selectedRoute.value?.available),
  canCancel: false,
}]);

watch(provider, () => { model.value = selectedRoute.value?.models[0] ?? ""; response.value = undefined; routeError.value = ""; });

onMounted(async () => {
  try {
    const fetched = await fetch("/api/routes");
    if (!fetched.ok) throw new Error(`routes-http-${fetched.status}`);
    routes.value = await fetched.json() as readonly Route[];
  } catch (error) {
    routeError.value = error instanceof Error ? error.message : "route-discovery-failed";
  }
});

function receive(event: FQueryUiEvent) { lastEvent.value = JSON.stringify(event); }

async function execute() {
  running.value = true;
  response.value = undefined;
  routeError.value = "";
  try {
    const fetched = await fetch("/api/decompose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider: provider.value, model: model.value, source: source.value }) });
    const payload: unknown = await fetched.json();
    if (!fetched.ok) throw new Error(isRecord(payload) && typeof payload.error === "string" ? payload.error : `decompose-http-${fetched.status}`);
    response.value = payload;
    if (isRecord(payload) && Array.isArray(payload.events)) lastEvent.value = JSON.stringify(payload.events.at(-1) ?? "完了");
  } catch (error) {
    routeError.value = error instanceof Error ? error.message : "decompose-failed";
  } finally {
    running.value = false;
  }
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

    <FQueryPanel :nodes="nodes" @event="receive" />
    <output aria-live="polite">last event: {{ lastEvent }}</output>
    <pre v-if="response" class="result" aria-label="candidate FAM">{{ JSON.stringify(response, null, 2) }}</pre>
  </div>
</template>
