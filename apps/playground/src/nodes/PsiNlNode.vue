<script setup lang="ts">
import { computed, inject } from "vue";
import type { FQueryUiEvent, NodeViewModel, PresentationProjection } from "@fquery/ui-core";
import { decomposerContextKey } from "../context.js";

/** Ψ.NL Input renderer。自然言語sourceとdecomposer（provider route）binding。 */
const props = defineProps<{ model: NodeViewModel; projection?: PresentationProjection | undefined }>();
const emit = defineEmits<{ event: [event: FQueryUiEvent] }>();
const context = inject(decomposerContextKey);
const selectedRoute = computed(() => context?.routes.value.find((route) => route.provider === context.provider.value));
const statusBadges = computed(() => props.model.badges.filter((badge) => ["transport", "plugin", "semantic"].includes(badge.axis)));
</script>

<template>
  <div class="psi-node" aria-label="route controls">
    <label>source
      <textarea v-if="context" v-model="context.source.value" rows="4" spellcheck="false" />
    </label>
    <div v-if="context" class="psi-node-route">
      <label>decomposer
        <select v-model="context.provider.value">
          <option v-for="route in context.routes.value" :key="route.provider" :value="route.provider" :disabled="!route.available">{{ route.label }}{{ route.available ? "" : " — unavailable" }}</option>
        </select>
      </label>
      <label>model
        <select v-model="context.model.value"><option v-for="candidate in selectedRoute?.models ?? []" :key="candidate" :value="candidate">{{ candidate }}</option></select>
      </label>
    </div>
    <div class="psi-node-actions">
      <button v-if="context" type="button" :disabled="context.running.value || !selectedRoute?.available || !context.model.value || !context.source.value.trim()" @click="context.execute()">{{ context.running.value ? "推論中…" : "分解を実行" }}</button>
      <button type="button" @click="emit('event', { type: 'inspect', nodeId: model.nodeId })">inspector</button>
    </div>
    <div class="psi-node-badges">
      <span v-for="badge in statusBadges" :key="badge.axis" class="fquery-badge" :data-axis="badge.axis" :data-tone="badge.tone"><small>{{ badge.axis }}</small>{{ badge.value }}</span>
    </div>
    <p v-if="selectedRoute?.credentialName" class="psi-node-muted">credential: {{ selectedRoute.credentialName }}</p>
  </div>
</template>

<style scoped>
.psi-node { display: grid; gap: 0.4rem; font-size: 0.75rem; }
.psi-node label { display: grid; gap: 0.2rem; color: #aeb8cc; }
.psi-node-route { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; }
.psi-node-actions { display: flex; gap: 0.4rem; }
.psi-node-actions button:first-child { color: #08101e; background: #79c0ff; border-color: #79c0ff; font-weight: 700; }
.psi-node-badges { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.psi-node-muted { margin: 0; color: #8b98b4; }
</style>
