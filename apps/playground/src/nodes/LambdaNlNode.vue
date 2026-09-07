<script setup lang="ts">
import { computed } from "vue";
import type { NodeViewModel, PresentationProjection } from "@fquery/ui-core";

/**
 * λ.NL Output renderer。engine／Hostが投影したmanifestationを表示するだけで、
 * λ satisfactionをGUIで判定しない。
 */
const props = defineProps<{ model: NodeViewModel; projection?: PresentationProjection | undefined }>();
const output = computed(() => isRecord(props.model.value) ? props.model.value : undefined);
const lines = computed(() => Array.isArray(output.value?.manifestations) ? output.value.manifestations.filter((line): line is string => typeof line === "string") : []);
const lambda = computed(() => props.model.badges.find((badge) => badge.axis === "lambda"));

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
</script>

<template>
  <div class="lambda-node">
    <template v-if="lines.length">
      <p class="lambda-node-meta">{{ output?.projection_kind ?? "projection" }} · {{ lines.length }} line(s)</p>
      <pre class="lambda-node-output">{{ lines.join("\n") }}</pre>
    </template>
    <p v-else class="lambda-node-muted">NOT PROVIDED — 上流FAMから出力がまだ投影されていない</p>
    <span v-if="lambda" class="fquery-badge" data-axis="lambda" :data-tone="lambda.tone"><small>λ</small>{{ lambda.value }}</span>
  </div>
</template>

<style scoped>
.lambda-node { display: grid; gap: 0.35rem; font-size: 0.75rem; }
.lambda-node-meta, .lambda-node-muted { margin: 0; color: #8b98b4; font-family: ui-monospace, monospace; }
.lambda-node-output { margin: 0; max-height: 7rem; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; color: #eef2ff; }
</style>
