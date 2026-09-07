<script setup lang="ts">
import { computed } from "vue";
import type { ConnectionViewModel, FQueryUiEvent, NodeSelection, NodeViewModel, PresentationProjection } from "@fquery/ui-core";

/**
 * 階層（outliner）。graph上のnodeを一覧し、click→select request、focusボタン→focus event。
 * 選択の正本はsessionなので、ここでは選択を確定しない。
 */
const props = defineProps<{
  nodes: readonly NodeViewModel[];
  selection: NodeSelection;
  connections?: readonly ConnectionViewModel[] | undefined;
  presentations?: Readonly<Record<string, PresentationProjection>> | undefined;
}>();
const emit = defineEmits<{ event: [event: FQueryUiEvent] }>();
let requestSequence = 0;

const rows = computed(() => props.nodes.map((node) => {
  const connectionCount = (props.connections ?? []).filter((connection) => node.ports.some((port) => port.portId === connection.fromPortId || port.portId === connection.toPortId)).length;
  const projection = props.presentations?.[node.nodeId];
  return { node, connectionCount, mode: projection?.mode ?? "none", semantic: node.badges.find((badge) => badge.axis === "semantic") };
}));

function select(node: NodeViewModel, additive: boolean) {
  requestSequence += 1;
  const current = props.selection.nodeIds;
  const nodeIds = additive ? (current.includes(node.nodeId) ? current.filter((id) => id !== node.nodeId) : [...current, node.nodeId]) : [node.nodeId];
  const activeNodeId = nodeIds.includes(node.nodeId) ? node.nodeId : nodeIds.at(-1);
  emit("event", { type: "node.select.requested", requestId: `ui:outliner:${requestSequence}`, nodeIds, ...(activeNodeId ? { activeNodeId } : {}) });
}
</script>

<template>
  <nav class="fquery-outliner" aria-label="node outliner">
    <p v-if="rows.length === 0" class="fquery-outliner-muted">nodeなし</p>
    <ul v-else role="listbox" aria-label="nodes">
      <li
        v-for="row in rows"
        :key="row.node.nodeId"
        role="option"
        :data-node-id="row.node.nodeId"
        :data-presentation-mode="row.mode"
        :aria-selected="selection.nodeIds.includes(row.node.nodeId) ? 'true' : 'false'"
        :data-active="selection.activeNodeId === row.node.nodeId ? 'true' : undefined"
      >
        <button type="button" class="fquery-outliner-select" @click="select(row.node, $event.shiftKey || $event.metaKey || $event.ctrlKey)" @dblclick="emit('event', { type: 'focus', nodeId: row.node.nodeId })">
          <strong>{{ row.node.label }}</strong>
          <small>{{ row.node.nodeId }}</small>
        </button>
        <span class="fquery-outliner-meta">
          <span class="fquery-outliner-links" :title="`${row.connectionCount} connection(s)`">⟷{{ row.connectionCount }}</span>
          <span v-if="row.semantic" class="fquery-badge" data-axis="semantic" :data-tone="row.semantic.tone"><small>semantic</small>{{ row.semantic.value }}</span>
          <span v-if="row.mode === 'ghost'" class="fquery-outliner-ghost" title="plugin未ロード／消失">ghost</span>
        </span>
        <button type="button" class="fquery-outliner-focus" :aria-label="`focus ${row.node.label}`" title="focus" @click="emit('event', { type: 'focus', nodeId: row.node.nodeId })">⌖</button>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.fquery-outliner ul { margin: 0; padding: 0; list-style: none; display: grid; gap: 0.2rem; }
.fquery-outliner li { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 0.4rem; border: 1px solid transparent; border-radius: 0.4rem; padding: 0.15rem 0.3rem; }
.fquery-outliner li[aria-selected="true"] { border-color: #59647a; background: #1b2231; }
.fquery-outliner li[data-active="true"] { border-color: #79c0ff; }
.fquery-outliner-select { display: grid; text-align: left; color: #eef2ff; background: transparent; border: 0; padding: 0.2rem 0.3rem; overflow: hidden; }
.fquery-outliner-select small { color: #8b98b4; font: 0.65rem ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fquery-outliner-meta { display: flex; gap: 0.3rem; align-items: center; font-size: 0.7rem; color: #aeb8cc; }
.fquery-outliner-ghost { color: #d2a8ff; }
.fquery-outliner-focus { color: #c9d5ed; background: #252d40; border: 1px solid #59647a; border-radius: 0.35rem; padding: 0.15rem 0.4rem; }
.fquery-outliner-select:focus-visible, .fquery-outliner-focus:focus-visible { outline: 3px solid #79c0ff; outline-offset: 2px; }
.fquery-outliner-muted { margin: 0; color: #8b98b4; font-size: 0.8rem; }
.fquery-badge { border: 1px solid currentColor; border-radius: 999px; padding: 0.05rem 0.35rem; font: 0.62rem/1.2 ui-monospace, monospace; }
.fquery-badge small { opacity: 0.68; margin-right: 0.25rem; }
.fquery-badge[data-tone="success"] { color: #7ee787; }
.fquery-badge[data-tone="notice"] { color: #79c0ff; }
.fquery-badge[data-tone="warning"] { color: #e3b341; }
.fquery-badge[data-tone="danger"] { color: #ff7b72; }
.fquery-badge[data-tone="unknown"] { color: #d2a8ff; }
</style>
