<script setup lang="ts">
import type { FQueryUiEvent, NodeViewModel } from "@fquery/ui-core";

const props = defineProps<{ model: NodeViewModel }>();
const emit = defineEmits<{ event: [event: FQueryUiEvent] }>();

function request(type: "inspect" | "preview" | "execute-request" | "cancel-request") {
  emit("event", { type, nodeId: props.model.nodeId });
}
</script>

<template>
  <article class="fquery-node" :data-node-id="model.nodeId" :aria-label="model.label">
    <header>
      <h3>{{ model.label }}</h3>
      <button type="button" @click="request('inspect')">inspect</button>
    </header>

    <p
      v-if="model.presentation"
      class="fquery-presentation-state"
      :data-presentation-mode="model.presentation.mode"
    >
      presentation: {{ model.presentation.mode }} / {{ model.presentation.rendererId }}
      <span v-if="model.presentation.reason">— {{ model.presentation.reason }}</span>
    </p>

    <div class="fquery-badges" aria-label="Q status axes">
      <span v-for="badge in model.badges" :key="badge.axis" class="fquery-badge" :data-axis="badge.axis" :data-tone="badge.tone">
        <small>{{ badge.axis }}</small>{{ badge.value }}
      </span>
    </div>

    <div class="fquery-ports">
      <span v-for="port in model.ports" :key="port.portId" class="fquery-port" :data-direction="port.direction" :data-connection="port.connectionStatus">
        {{ port.label }}: {{ port.connectionStatus }}
      </span>
    </div>

    <section v-if="model.lastOrder" class="fquery-last-order" aria-label="Last Order">
      <strong>{{ model.lastOrder.code }}</strong>
      <p>{{ model.lastOrder.reason }}</p>
      <p>next: {{ model.lastOrder.requestedNext }}</p>
      <p>resume: {{ model.lastOrder.resumeWhen }}</p>
    </section>

    <footer>
      <button type="button" @click="request('preview')">preview</button>
      <button type="button" :disabled="!model.canExecute" @click="request('execute-request')">execute</button>
      <button type="button" :disabled="!model.canCancel" @click="request('cancel-request')">cancel</button>
    </footer>
  </article>
</template>

<style scoped>
.fquery-node { border: 1px solid #59647a; border-radius: 0.75rem; color: #eef2ff; background: #161b27; padding: 1rem; display: grid; gap: 0.75rem; }
.fquery-node header, .fquery-node footer, .fquery-ports { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
.fquery-node h3 { margin: 0 auto 0 0; font-size: 1rem; }
.fquery-presentation-state { margin: 0; color: #aeb8cc; font: 0.75rem/1.3 ui-monospace, monospace; }
.fquery-presentation-state[data-presentation-mode="ghost"] { color: #d2a8ff; border-left: 0.35rem dotted currentColor; padding-left: 0.5rem; }
.fquery-presentation-state[data-presentation-mode="generic"] { color: #e3b341; }
.fquery-badges { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.fquery-badge { border: 1px solid currentColor; border-radius: 999px; padding: 0.2rem 0.45rem; font: 0.75rem/1.2 ui-monospace, monospace; }
.fquery-badge small { opacity: 0.68; margin-right: 0.35rem; }
.fquery-badge[data-tone="success"] { color: #7ee787; }
.fquery-badge[data-tone="notice"] { color: #79c0ff; }
.fquery-badge[data-tone="warning"] { color: #e3b341; }
.fquery-badge[data-tone="danger"] { color: #ff7b72; }
.fquery-badge[data-tone="unknown"] { color: #d2a8ff; }
.fquery-port { border-left: 0.35rem solid #79c0ff; padding-left: 0.4rem; }
.fquery-port[data-connection="unconnected"] { border-left-style: dotted; }
.fquery-last-order { border-left: 0.35rem solid #e3b341; padding-left: 0.75rem; }
.fquery-last-order p { margin: 0.2rem 0; }
button { color: inherit; background: #252d40; border: 1px solid #59647a; border-radius: 0.35rem; padding: 0.3rem 0.55rem; }
button:focus-visible { outline: 3px solid #79c0ff; outline-offset: 2px; }
button:disabled { opacity: 0.45; }
</style>
