<script setup lang="ts">
// paneの@eventリスナーがroot componentへfallthroughして二重配送になるのを防ぐ
defineOptions({ inheritAttrs: false });
import { inject } from "vue";
import { FQueryNodePanel } from "@fquery/ui-vue";
import type { PaneContext } from "@fquery/ui-core";
import { playgroundPaneContextKey } from "../context.js";
defineProps<{ context: PaneContext }>();
const host = inject(playgroundPaneContextKey);
</script>
<template>
  <FQueryNodePanel
    v-if="host && context.activeNode"
    only="unsupported"
    :node="context.activeNode"
    :registration="host.selectedRegistration.value"
    :projection="host.selectedProjection.value"
    :connections="host.sessionState.value.connections"
    :validate="host.validate"
    @event="host.receive($event)"
  />
  <p v-else class="fquery-pane-muted">active nodeなし</p>
</template>
