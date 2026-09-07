<script setup lang="ts">
import { computed, provide, watch, type Component } from "vue";
import { BaklavaEditor, useBaklava } from "@baklavajs/renderer-vue";
import type { ConnectionViewModel, FQueryUiEvent, NodeViewModel, PresentationProjection } from "@fquery/ui-core";
import { BaklavaPresentationAdapter, type BaklavaLayoutValue } from "./baklava-adapter.js";
import { canvasContextKey } from "./canvas-context.js";
import "@baklavajs/themes/dist/syrup-dark.css";

const props = defineProps<{
  nodes: readonly NodeViewModel[];
  connections?: readonly ConnectionViewModel[] | undefined;
  layout?: readonly BaklavaLayoutValue[] | undefined;
  /** targetRef -> projection。inline node描画のrenderer選択に使う */
  presentations?: Readonly<Record<string, PresentationProjection>> | undefined;
  /** rendererHint -> plugin renderer component。指定するとnode本体をcanvas内へ描画する */
  nodeRenderers?: Readonly<Record<string, Component>> | undefined;
  fill?: boolean | undefined;
}>();
const emit = defineEmits<{ event: [event: FQueryUiEvent] }>();
// reactive editorを先に作り、adapterはそのproxy経由でgraphを変更する（mount後の追加も描画へ伝播させる）
const viewModel = useBaklava();
const adapter = new BaklavaPresentationAdapter((event) => emit("event", event), { editor: viewModel.editor, inlineContent: props.nodeRenderers !== undefined });

provide(canvasContextKey, {
  modelById: computed(() => new Map(props.nodes.map((node) => [node.nodeId, node]))),
  presentations: computed(() => props.presentations ?? {}),
  renderers: computed(() => props.nodeRenderers ?? {}),
  emit: (event) => emit("event", event),
});

watch(
  () => [props.nodes, props.connections ?? [], props.layout ?? []] as const,
  ([nodes, connections, layout]) => adapter.sync(nodes, connections, layout),
  { immediate: true, deep: true },
);
</script>

<template>
  <section class="fquery-baklava syrup-dark" :data-fill="fill ? 'true' : undefined" aria-label="FQuery Baklava presentation" @pointerup="adapter.requestMovedNodes(nodes)">
    <BaklavaEditor :view-model="viewModel" />
  </section>
</template>

<style scoped>
.fquery-baklava { height: min(30rem, 58vh); min-height: 18rem; overflow: hidden; border: 1px solid #34405a; border-radius: 0.75rem; background: #080b13; }
.fquery-baklava[data-fill="true"] { height: 100%; min-height: 0; border: 0; border-radius: 0; }
</style>
