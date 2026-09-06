<script setup lang="ts">
import { watch } from "vue";
import { BaklavaEditor, useBaklava } from "@baklavajs/renderer-vue";
import type { ConnectionViewModel, GuiEventAbi, NodeViewModel } from "@fquery/ui-core";
import { BaklavaPresentationAdapter, type BaklavaLayoutValue } from "./baklava-adapter.js";
import "@baklavajs/themes/dist/syrup-dark.css";

const props = withDefaults(defineProps<{
  nodes: readonly NodeViewModel[];
  connections?: readonly ConnectionViewModel[];
  layout?: readonly BaklavaLayoutValue[];
}>(), { connections: () => [], layout: () => [] });
const emit = defineEmits<{ event: [event: GuiEventAbi] }>();
const adapter = new BaklavaPresentationAdapter((event) => emit("event", event));
const viewModel = useBaklava(adapter.editor);

watch(
  () => [props.nodes, props.connections, props.layout] as const,
  ([nodes, connections, layout]) => adapter.sync(nodes, connections, layout),
  { immediate: true, deep: true },
);
</script>

<template>
  <section class="fquery-baklava syrup-dark" aria-label="FQuery Baklava presentation" @pointerup="adapter.requestMovedNodes(nodes)">
    <BaklavaEditor :view-model="viewModel" />
  </section>
</template>

<style scoped>
.fquery-baklava { min-height: 30rem; overflow: hidden; border: 1px solid #34405a; border-radius: 0.75rem; background: #080b13; }
</style>
