<script setup lang="ts">
// paneの@eventリスナーがroot componentへfallthroughして二重配送になるのを防ぐ
defineOptions({ inheritAttrs: false });
import { inject } from "vue";
import { FQueryOutliner } from "@fquery/ui-vue";
import { playgroundPaneContextKey } from "../context.js";
const host = inject(playgroundPaneContextKey);
</script>
<template>
  <FQueryOutliner v-if="host" :nodes="host.sessionState.value.nodes" :selection="host.sessionState.value.selection" :connections="host.sessionState.value.connections" :presentations="host.sessionState.value.presentations" @event="host.receive($event)" />
</template>
