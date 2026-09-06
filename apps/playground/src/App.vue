<script setup lang="ts">
import { ref } from "vue";
import { FQueryPanel } from "@fquery/ui-vue";
import type { FQueryUiEvent, NodeViewModel } from "@fquery/ui-core";

const provider = ref("fixture");
const model = ref("mock-fam-transformer");
const source = ref("このFAM blockを意味単位へ分解する");
const lastEvent = ref("未実行");

const nodes: readonly NodeViewModel[] = [{
  nodeId: "q://playground/fam-decompose",
  label: "fam.decompose",
  badges: [
    { axis: "resolution", value: "resolved", tone: "success" },
    { axis: "connection", value: "unconnected", tone: "notice" },
    { axis: "plugin", value: "not-requested", tone: "notice" },
    { axis: "semantic", value: "unknown", tone: "unknown" },
  ],
  ports: [
    { portId: "source", label: "source FAM", direction: "input", connectionStatus: "connected" },
    { portId: "candidate", label: "candidate FAM", direction: "output", connectionStatus: "unconnected" },
  ],
  value: null,
  evidenceRefs: [],
  canExecute: true,
  canCancel: false,
}];

function receive(event: FQueryUiEvent) {
  lastEvent.value = JSON.stringify(event);
}
</script>

<template>
  <div class="shell">
    <header class="hero">
      <div>
        <p class="eyebrow">LOCALHOST / FIXTURE MODE</p>
        <h1>FQuery Playground</h1>
        <p>Proton拘束されたFAM変換routeを、APIキーなしで先に検査します。</p>
      </div>
    </header>

    <section class="controls" aria-label="route controls">
      <label>Provider<select v-model="provider"><option value="fixture">fixture</option><option value="gemini" disabled>gemini — 未接続</option></select></label>
      <label>Model<input v-model="model" /></label>
      <label class="source">Source FAM block<textarea v-model="source" rows="5" /></label>
    </section>

    <FQueryPanel :nodes="nodes" @event="receive" />
    <output aria-live="polite">last event: {{ lastEvent }}</output>
  </div>
</template>
