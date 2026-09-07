<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { deriveKnownPointers, type ConnectionViewModel, type FQueryUiEvent, type NodeViewModel, type PluginPresentationRegistration, type PresentationProjection, type QSchemaProperty } from "@fquery/ui-core";
import { createFamDraftPatch, getAtPointer, openFamText, partitionPointers, serializeFamValue, type FamValidator, type JsonValue } from "@fquery/fam-edit";
import FQueryFamvim from "./FQueryFamvim.vue";

/**
 * Q-schema駆動Node Panel（Issue #27）。
 * pluginが認識するQ fieldだけを編集し、認識できないfield／subtreeは
 * Unsupported Dataとして列挙し、RAW FAM（FAMVIM）で常に到達可能にする。
 * `unsupported != invalid`、`GUI controllerにない != dataが存在しない`。
 */
const props = defineProps<{
  node: NodeViewModel;
  registration?: PluginPresentationRegistration | undefined;
  projection?: PresentationProjection | undefined;
  connections?: readonly ConnectionViewModel[] | undefined;
  validate?: FamValidator | undefined;
  /** Hostからtabを指定する（例: canvas nodeの「RAW編集」からRAW FAMを開く） */
  tab?: "settings" | "connections" | "q" | "unsupported" | "raw" | undefined;
  /** 1 tab分だけをsectionとして描画する（pane contribution用）。tab stripとheaderは出さない */
  only?: "settings" | "connections" | "q" | "unsupported" | "raw" | undefined;
  /** only="raw"のときにFAMVIMへ渡すjump先pointer */
  jumpPointer?: string | null | undefined;
}>();
const emit = defineEmits<{ event: [event: FQueryUiEvent] }>();

type Tab = "settings" | "connections" | "q" | "unsupported" | "raw";
const tabs: readonly { readonly id: Tab; readonly label: string }[] = [
  { id: "settings", label: "設定" },
  { id: "connections", label: "接続" },
  { id: "q", label: "Q" },
  { id: "unsupported", label: "Unsupported Data" },
  { id: "raw", label: "RAW FAM" },
];
const active = computed<Tab>({ get: () => props.only ?? activeState.value, set: (value) => { activeState.value = value; } });
const activeState = ref<Tab>("settings");
const jumpTo = ref<string | null>(null);
let requestSequence = 0;

// node またはpluginが切り替わったときだけtabを初期化する（valueの更新では維持する）
watch(() => `${props.node.nodeId} ${props.registration?.presentation.presentationId ?? ""}`, () => { activeState.value = props.tab ?? "settings"; jumpTo.value = null; });
watch(() => props.tab, (tab) => { if (tab) activeState.value = tab; }, { immediate: true });
watch(() => props.jumpPointer, (pointer) => { if (pointer !== undefined) jumpTo.value = pointer; }, { immediate: true });

const editor = computed(() => props.registration?.editor);
const knownPointers = computed(() => deriveKnownPointers(editor.value));
const canonical = computed(() => props.node.value === null || props.node.value === undefined ? undefined : openFamText(serializeFamValue(props.node.value as JsonValue)));
const canonicalValue = computed(() => canonical.value?.parse === "parsed" ? canonical.value.value : undefined);
const partition = computed(() => canonicalValue.value === undefined ? undefined : partitionPointers(canonicalValue.value, knownPointers.value));
const qProperties = computed(() => Object.entries(editor.value?.qSchema?.properties ?? {}));
const ghost = computed(() => props.projection?.mode === "ghost" || (!props.registration && props.projection !== undefined));
const nodeConnections = computed(() => (props.connections ?? []).filter((connection) => props.node.ports.some((port) => port.portId === connection.fromPortId || port.portId === connection.toPortId)));

function qPointer(key: string): string {
  return `/Q/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`;
}

function qValue(key: string): JsonValue | undefined {
  return canonicalValue.value === undefined ? undefined : getAtPointer(canonicalValue.value, qPointer(key));
}

function coerce(property: QSchemaProperty, raw: string | boolean): JsonValue {
  if (property.type === "boolean") return Boolean(raw);
  if (property.type === "number") { const parsed = Number(raw); return Number.isFinite(parsed) ? parsed : String(raw); }
  return String(raw);
}

function requestQChange(key: string, property: QSchemaProperty, raw: string | boolean) {
  if (property.readOnly) return;
  const exists = qValue(key) !== undefined;
  const path = qPointer(key);
  const value = coerce(property, raw);
  requestSequence += 1;
  emit("event", {
    type: "property.change.requested",
    requestId: `ui:node-panel:${requestSequence}`,
    targetRef: props.node.nodeId,
    property: "fam.patch",
    value: createFamDraftPatch([exists ? { op: "set", path, value } : { op: "insert", path, value }]),
  });
}

function requestDisconnect(connection: ConnectionViewModel) {
  requestSequence += 1;
  emit("event", { type: "connection.remove.requested", requestId: `ui:node-panel:${requestSequence}`, connectionId: connection.connectionId });
}

function jumpToRaw(pointer: string) {
  if (props.only) {
    // sectionとして分割されているときはHostへjumpを委ね、Hostがpane tabを切り替える
    emit("event", { type: "jump", nodeId: props.node.nodeId, pointer });
    return;
  }
  jumpTo.value = pointer;
  activeState.value = "raw";
}

function inputValue(key: string): string {
  const value = qValue(key);
  return value === undefined || value === null ? "" : typeof value === "string" ? value : JSON.stringify(value);
}

function targetValue(event: Event): string { return (event.target as HTMLInputElement | HTMLSelectElement).value; }
function targetChecked(event: Event): boolean { return (event.target as HTMLInputElement).checked; }
</script>

<template>
  <section class="fquery-node-panel" :data-node-id="node.nodeId" :data-only="only" aria-label="FQuery node panel">
    <header v-if="!only || only === 'settings'">
      <h3 v-if="!only">{{ node.label }}</h3>
      <p v-if="ghost" class="fquery-node-panel-ghost" role="status">ghost: plugin未ロード／消失。dataは保持され、RAW FAMで編集可能</p>
    </header>

    <div v-if="!only" class="fquery-node-panel-tabs" role="tablist" aria-label="node panel tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        role="tab"
        :data-tab="tab.id"
        :aria-selected="active === tab.id ? 'true' : 'false'"
        @click="active = tab.id"
      >{{ tab.label }}<small v-if="tab.id === 'unsupported' && partition"> ({{ partition.unsupported.length }})</small></button>
    </div>

    <section v-if="active === 'settings'" role="tabpanel" data-tab-panel="settings">
      <dl>
        <dt>nodeId</dt><dd>{{ node.nodeId }}</dd>
        <dt>plugin</dt><dd>{{ registration ? `${registration.pluginId}@${registration.pluginVersion}` : "NOT REGISTERED" }}</dd>
        <dt>capability</dt><dd>{{ registration?.capability ?? "-" }}</dd>
        <dt>famRole</dt><dd>{{ editor?.famRole ?? "undeclared" }}</dd>
        <dt>presentation</dt><dd>{{ projection ? `${projection.mode} / ${projection.rendererId}` : "-" }}<span v-if="projection?.reason"> — {{ projection.reason }}</span></dd>
      </dl>
      <!-- Hostがnode固有のinspector（Ψ.NLのdecomposer binding等）を差し込むslot。GUI Coreはその内容を解釈しない -->
      <slot name="inspector" :node="node" :registration="registration" />
    </section>

    <section v-else-if="active === 'connections'" role="tabpanel" data-tab-panel="connections">
      <ul class="fquery-node-panel-ports">
        <li v-for="port in node.ports" :key="port.portId" :data-direction="port.direction" :data-connection="port.connectionStatus">{{ port.direction }} {{ port.label }}: {{ port.connectionStatus }}</li>
      </ul>
      <ul class="fquery-node-panel-connections">
        <li v-for="connection in nodeConnections" :key="connection.connectionId">
          <code>{{ connection.fromPortId }} → {{ connection.toPortId }}</code>
          <button type="button" @click="requestDisconnect(connection)">切断をrequest</button>
        </li>
      </ul>
      <p v-if="nodeConnections.length === 0" class="fquery-node-panel-muted">unconnected（failureではない）</p>
    </section>

    <section v-else-if="active === 'q'" role="tabpanel" data-tab-panel="q">
      <p v-if="qProperties.length === 0" class="fquery-node-panel-muted">このpluginはQ schemaを宣言していない。Q fieldはUnsupported DataまたはRAW FAMから編集する</p>
      <p v-else-if="canonicalValue === undefined" class="fquery-node-panel-muted">canonical FAM未生成</p>
      <div v-else class="fquery-node-panel-q">
        <label v-for="[key, property] in qProperties" :key="key" :data-q-key="key">
          <span>{{ property.label ?? key }}<small v-if="property.readOnly"> read-only</small></span>
          <input v-if="property.type === 'boolean'" type="checkbox" :checked="Boolean(qValue(key))" :disabled="property.readOnly" @change="requestQChange(key, property, targetChecked($event))" />
          <select v-else-if="property.type === 'enum'" :value="inputValue(key)" :disabled="property.readOnly" @change="requestQChange(key, property, targetValue($event))">
            <option v-for="candidate in property.enum ?? []" :key="candidate" :value="candidate">{{ candidate }}</option>
          </select>
          <input v-else :type="property.type === 'number' ? 'number' : 'text'" :value="inputValue(key)" :disabled="property.readOnly" @change="requestQChange(key, property, targetValue($event))" />
          <small v-if="qValue(key) === undefined" class="fquery-node-panel-muted">未設定（insertとしてrequest）</small>
        </label>
      </div>
    </section>

    <section v-else-if="active === 'unsupported'" role="tabpanel" data-tab-panel="unsupported">
      <p class="fquery-node-panel-muted">このpanelが編集できないがcanonical FAMに存在するfield。無効ではなく、RAW FAMで編集できる</p>
      <ul v-if="partition" class="fquery-node-panel-unsupported">
        <li v-for="pointer in partition.unsupported" :key="pointer">
          <code>{{ pointer }}</code>
          <button type="button" :data-jump="pointer" @click="jumpToRaw(pointer)">RAWへ</button>
        </li>
      </ul>
      <p v-else class="fquery-node-panel-muted">canonical FAM未生成</p>
    </section>

    <section v-else role="tabpanel" data-tab-panel="raw">
      <FQueryFamvim :target-ref="node.nodeId" :value="node.value ?? undefined" :validate="validate" :known-pointers="knownPointers" :jump-to="jumpTo" @event="emit('event', $event)" />
    </section>
  </section>
</template>

<style scoped>
.fquery-node-panel { display: grid; gap: 0.75rem; padding: 1rem; color: #eef2ff; background: #111724; border: 1px solid #34405a; border-radius: 0.75rem; }
.fquery-node-panel header h3 { margin: 0; font-size: 1rem; }
.fquery-node-panel-ghost { margin: 0.25rem 0 0; color: #d2a8ff; border-left: 0.35rem dotted currentColor; padding-left: 0.5rem; }
.fquery-node-panel-tabs { display: flex; gap: 0.25rem; flex-wrap: wrap; border-bottom: 1px solid #34405a; }
.fquery-node-panel-tabs button { color: #aeb8cc; background: transparent; border: 0; border-bottom: 2px solid transparent; padding: 0.4rem 0.6rem; }
.fquery-node-panel-tabs button[aria-selected="true"] { color: #79c0ff; border-bottom-color: #79c0ff; }
.fquery-node-panel dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.3rem 1rem; margin: 0; font: 0.8rem/1.4 ui-monospace, monospace; }
.fquery-node-panel dd { margin: 0; overflow-wrap: anywhere; }
.fquery-node-panel-ports, .fquery-node-panel-connections, .fquery-node-panel-unsupported { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.35rem; font: 0.8rem/1.4 ui-monospace, monospace; }
.fquery-node-panel-ports li { border-left: 0.35rem solid #79c0ff; padding-left: 0.4rem; }
.fquery-node-panel-ports li[data-connection="unconnected"] { border-left-style: dotted; }
.fquery-node-panel-connections li, .fquery-node-panel-unsupported li { display: flex; gap: 0.5rem; align-items: center; justify-content: space-between; }
.fquery-node-panel-q { display: grid; gap: 0.6rem; }
.fquery-node-panel-q label { display: grid; gap: 0.25rem; color: #aeb8cc; }
.fquery-node-panel-q input[type="text"], .fquery-node-panel-q input[type="number"], .fquery-node-panel-q select { color: #eef2ff; background: #161b27; border: 1px solid #59647a; border-radius: 0.4rem; padding: 0.4rem; }
.fquery-node-panel-muted { margin: 0; color: #8b98b4; }
.fquery-node-panel button { color: inherit; background: #252d40; border: 1px solid #59647a; border-radius: 0.35rem; padding: 0.3rem 0.55rem; }
.fquery-node-panel button:focus-visible { outline: 3px solid #79c0ff; outline-offset: 2px; }
</style>
