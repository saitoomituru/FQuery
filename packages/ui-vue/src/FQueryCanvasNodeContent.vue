<script setup lang="ts">
import { computed, inject } from "vue";
import type { AbstractNode, NodeInterface } from "@baklavajs/core";
import { canvasContextKey } from "./canvas-context.js";

/**
 * canvas上のnode本体。Baklavaの非port interface componentとして描画され、
 * 中身はPresentation FAMの`rendererHint`に対応するplugin rendererへ委譲する。
 * rendererが無い／plugin消失（ghost）／renderer非対応（generic）はgeneric cardへfallbackする。
 */
const props = defineProps<{ intf: NodeInterface<unknown>; node: AbstractNode; modelValue?: unknown }>();
const context = inject(canvasContextKey);

const model = computed(() => context?.modelById.value.get(props.node.id));
const projection = computed(() => context?.presentations.value[props.node.id]);
const renderer = computed(() => {
  const hint = projection.value?.presentation?.rendererHint;
  if (projection.value?.mode !== "native" || !hint) return undefined;
  return context?.renderers.value[hint];
});
const valueSummary = computed(() => {
  const value = model.value?.value;
  if (value === null || value === undefined) return "NOT PROVIDED";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
});
</script>

<template>
  <div class="fquery-canvas-node" :data-node-id="node.id" :data-presentation-mode="projection?.mode ?? 'none'" @keydown.stop @wheel.stop>
    <component :is="renderer" v-if="renderer && model && context" :model="model" :projection="projection" @event="context.emit($event)" />
    <div v-else-if="model && context" class="fquery-canvas-node-generic">
      <p v-if="projection?.mode === 'ghost'" class="fquery-canvas-node-ghost" role="status">ghost — plugin未ロード／消失。dataは保持</p>
      <p v-else-if="projection?.mode === 'generic'" class="fquery-canvas-node-muted">generic — renderer未対応（{{ projection.reason ?? "no renderer" }}）</p>
      <div class="fquery-canvas-node-badges">
        <span v-for="badge in model.badges" :key="badge.axis" class="fquery-badge" :data-axis="badge.axis" :data-tone="badge.tone"><small>{{ badge.axis }}</small>{{ badge.value }}</span>
      </div>
      <pre class="fquery-canvas-node-value">{{ valueSummary }}</pre>
      <button type="button" @click="context.emit({ type: 'inspect', nodeId: model.nodeId })">inspect</button>
    </div>
    <p v-else class="fquery-canvas-node-muted">projection未接続</p>
  </div>
</template>

<style>
.fquery-canvas-node { display: grid; gap: 0.4rem; padding: 0.2rem 0.1rem 0.3rem; cursor: default; }
.fquery-canvas-node-generic { display: grid; gap: 0.35rem; font-size: 0.75rem; }
.fquery-canvas-node-badges { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.fquery-canvas-node .fquery-badge { border: 1px solid currentColor; border-radius: 999px; padding: 0.1rem 0.4rem; font: 0.68rem/1.2 ui-monospace, monospace; }
.fquery-canvas-node .fquery-badge small { opacity: 0.68; margin-right: 0.3rem; }
.fquery-canvas-node .fquery-badge[data-tone="success"] { color: #7ee787; }
.fquery-canvas-node .fquery-badge[data-tone="notice"] { color: #79c0ff; }
.fquery-canvas-node .fquery-badge[data-tone="warning"] { color: #e3b341; }
.fquery-canvas-node .fquery-badge[data-tone="danger"] { color: #ff7b72; }
.fquery-canvas-node .fquery-badge[data-tone="unknown"] { color: #d2a8ff; }
.fquery-canvas-node-value { margin: 0; max-height: 6rem; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 0.7rem; color: #aeb8cc; }
.fquery-canvas-node-ghost { margin: 0; color: #d2a8ff; border-left: 0.3rem dotted currentColor; padding-left: 0.4rem; }
.fquery-canvas-node-muted { margin: 0; color: #8b98b4; }
.fquery-canvas-node button { color: inherit; background: #252d40; border: 1px solid #59647a; border-radius: 0.35rem; padding: 0.25rem 0.5rem; font-size: 0.75rem; }
.fquery-canvas-node textarea, .fquery-canvas-node select, .fquery-canvas-node input { width: 100%; color: #eef2ff; background: #0d1117; border: 1px solid #59647a; border-radius: 0.35rem; padding: 0.35rem; font: 0.75rem/1.35 ui-monospace, monospace; }
</style>
