<script setup lang="ts">
import { computed, provide, watch, type Component } from "vue";
import { BaklavaEditor, useBaklava } from "@baklavajs/renderer-vue";
import { selectionEquals, type ConnectionViewModel, type FQueryUiEvent, type NodeSelection, type NodeViewModel, type PresentationProjection } from "@fquery/ui-core";
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
  /** sessionのselection。Baklava selectionと双方向に同期するが、正本はsession側 */
  selection?: NodeSelection | undefined;
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

let selectSequence = 0;
function baklavaSelection(): NodeSelection {
  const nodeIds = viewModel.displayedGraph.selectedNodes.map((node) => node.id);
  const active = nodeIds.at(-1);
  return { nodeIds, ...(active ? { activeNodeId: active } : {}) };
}

// Baklava上のclick／box selectをrequestへ変換する。GUIは選択を確定せずsessionへ委ねる
watch(
  () => viewModel.displayedGraph.selectedNodes.map((node) => node.id).join("\u0001"),
  () => {
    const next = baklavaSelection();
    if (props.selection && selectionEquals(next, props.selection)) return;
    selectSequence += 1;
    emit("event", { type: "node.select.requested", requestId: `ui:select:${selectSequence}`, nodeIds: next.nodeIds, ...(next.activeNodeId ? { activeNodeId: next.activeNodeId } : {}) });
  },
);

// session側の選択（outliner／inspect由来）をBaklavaへ反映する
watch(
  () => props.selection,
  (selection) => {
    if (!selection || selectionEquals(selection, baklavaSelection())) return;
    const byId = new Map(viewModel.displayedGraph.nodes.map((node) => [node.id, node]));
    const ordered = selection.nodeIds.filter((id) => id !== selection.activeNodeId).concat(selection.activeNodeId ? [selection.activeNodeId] : []);
    viewModel.displayedGraph.selectedNodes = ordered.map((id) => byId.get(id)).filter((node): node is NonNullable<typeof node> => node !== undefined);
  },
  { immediate: true },
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
