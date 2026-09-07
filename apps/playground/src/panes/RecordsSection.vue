<script setup lang="ts">
// paneの@eventリスナーがroot componentへfallthroughして二重配送になるのを防ぐ
defineOptions({ inheritAttrs: false });
import { inject } from "vue";
import { FQueryRecordsPanel } from "@fquery/ui-vue";
import { playgroundPaneContextKey } from "../context.js";
const host = inject(playgroundPaneContextKey);
</script>
<template>
  <FQueryRecordsPanel v-if="host" :fam="host.fam.value" :semantic-projection="host.semanticProjection.value" :provider-receipt="host.providerReceipt.value" :debug-events="host.debugEvents.value" />
</template>
