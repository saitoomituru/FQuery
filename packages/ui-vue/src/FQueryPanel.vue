<script setup lang="ts">
import type { FQueryUiEvent, NodeViewModel } from "@fquery/ui-core";
import FQueryNode from "./FQueryNode.vue";

defineProps<{ nodes: readonly NodeViewModel[] }>();
const emit = defineEmits<{ event: [event: FQueryUiEvent] }>();
</script>

<template>
  <main class="fquery-panel" aria-label="FQuery node viewer">
    <FQueryNode v-for="node in nodes" :key="node.nodeId" :model="node" @event="emit('event', $event)" />
  </main>
</template>

<style scoped>
.fquery-panel { display: grid; gap: 1rem; padding: 1rem; background: #0d1117; }
</style>
