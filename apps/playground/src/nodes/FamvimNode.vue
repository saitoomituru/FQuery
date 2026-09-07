<script setup lang="ts">
import { computed } from "vue";
import type { FQueryUiEvent, NodeViewModel, PresentationProjection } from "@fquery/ui-core";

/** ∇φ.FAMVIM renderer。canonical FAMの要約を表示し、RAW編集はinspector drawerのFAMVIMへ委譲する。 */
const props = defineProps<{ model: NodeViewModel; projection?: PresentationProjection | undefined }>();
const emit = defineEmits<{ event: [event: FQueryUiEvent] }>();

const fam = computed(() => isRecord(props.model.value) ? props.model.value : undefined);
const units = computed(() => {
  const lambda = fam.value?.λ;
  return isRecord(lambda) && Array.isArray(lambda.output_units) ? lambda.output_units : [];
});
const unknowns = computed(() => {
  const q = fam.value?.Q;
  return isRecord(q) && Array.isArray(q.unknowns) ? q.unknowns.length : 0;
});
const semantic = computed(() => props.model.badges.find((badge) => badge.axis === "semantic"));

function unitText(unit: unknown): string {
  if (!isRecord(unit) || !isRecord(unit.λ)) return "";
  return typeof unit.λ.manifestation === "string" ? unit.λ.manifestation : "";
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
</script>

<template>
  <div class="famvim-node">
    <template v-if="fam">
      <p class="famvim-node-title"><strong>{{ fam.title }}</strong></p>
      <p class="famvim-node-meta"><code>{{ fam.fam_id }}</code> · units={{ units.length }} · unknowns={{ unknowns }}</p>
      <ol class="famvim-node-units">
        <li v-for="(unit, index) in units.slice(0, 5)" :key="index">{{ unitText(unit) }}</li>
        <li v-if="units.length > 5" class="famvim-node-muted">… 他{{ units.length - 5 }}件</li>
      </ol>
    </template>
    <p v-else class="famvim-node-muted">canonical FAM未生成 — Ψ.NLから分解を実行するか、RAW編集で作成</p>
    <div class="famvim-node-actions">
      <button type="button" @click="emit('event', { type: 'inspect', nodeId: model.nodeId })">RAW編集 / Unsupported Data</button>
      <span v-if="semantic" class="fquery-badge" data-axis="semantic" :data-tone="semantic.tone"><small>semantic</small>{{ semantic.value }}</span>
    </div>
  </div>
</template>

<style scoped>
.famvim-node { display: grid; gap: 0.35rem; font-size: 0.75rem; }
.famvim-node-title, .famvim-node-meta, .famvim-node-muted { margin: 0; overflow-wrap: anywhere; }
.famvim-node-meta { color: #aeb8cc; font-family: ui-monospace, monospace; }
.famvim-node-units { margin: 0; padding-left: 1.2rem; max-height: 7rem; overflow: auto; }
.famvim-node-muted { color: #8b98b4; }
.famvim-node-actions { display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; }
</style>
