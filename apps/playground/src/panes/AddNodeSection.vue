<script setup lang="ts">
// paneの@eventリスナーがroot componentへfallthroughして二重配送になるのを防ぐ
defineOptions({ inheritAttrs: false });
import { inject } from "vue";
import { FQueryPalette } from "@fquery/ui-vue";
import { playgroundPaneContextKey } from "../context.js";
const host = inject(playgroundPaneContextKey);
</script>
<template>
  <FQueryPalette v-if="host" :registrations="host.registrations.value" @event="host.receive($event)" />
</template>
