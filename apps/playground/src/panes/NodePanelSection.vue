<script setup lang="ts">
// paneの@eventリスナーがroot componentへfallthroughして二重配送になるのを防ぐ
defineOptions({ inheritAttrs: false });
import { inject } from "vue";
import { FQueryNodePanel } from "@fquery/ui-vue";
import type { PaneContext } from "@fquery/ui-core";
import { playgroundPaneContextKey } from "../context.js";
/** 暫定: 既存のFQueryNodePanel（5 tab）を1 sectionとして載せる。PR-Dで各tabをsectionへ分解する。 */
defineProps<{ context: PaneContext }>();
const host = inject(playgroundPaneContextKey);
</script>
<template>
  <FQueryNodePanel
    v-if="host && context.activeNode"
    :node="context.activeNode"
    :registration="host.selectedRegistration.value"
    :projection="host.selectedProjection.value"
    :connections="host.sessionState.value.connections"
    :validate="host.validate"
    :tab="host.inspectorTab.value"
    @event="host.receive($event)"
  />
  <p v-else class="fquery-pane-muted">active nodeなし</p>
</template>
