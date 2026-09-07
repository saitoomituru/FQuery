<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Connection } from "@baklavajs/core";
import type { FQueryBaklavaViewModel } from "@baklavajs/renderer-vue";

const props = defineProps<{
  connection: Connection;
  viewModel: FQueryBaklavaViewModel;
}>();

const coordinates = ref({ x1: 0, y1: 0, x2: 0, y2: 0 });
let resizeObserver: ResizeObserver | undefined;

function resolvePort(interfaceId: string) {
  const intf = document.getElementById(interfaceId);
  const node = intf?.closest<HTMLElement>(".baklava-node") ?? null;
  const port = intf?.querySelector<HTMLElement>(".__port") ?? null;
  return { intf, node, port };
}

function portCoordinates(interfaceId: string): [number, number] {
  const { intf, node, port } = resolvePort(interfaceId);
  if (!intf || !node || !port) return [0, 0];
  return [
    node.offsetLeft + intf.offsetLeft + port.offsetLeft + port.clientWidth / 2,
    node.offsetTop + intf.offsetTop + port.offsetTop + port.clientHeight / 2,
  ];
}

function observeNodeSizes(): void {
  resizeObserver?.disconnect();
  if (typeof ResizeObserver === "undefined") return;
  resizeObserver = new ResizeObserver(updateCoordinates);
  const from = resolvePort(props.connection.from.id).node;
  const to = resolvePort(props.connection.to.id).node;
  if (from) resizeObserver.observe(from);
  if (to && to !== from) resizeObserver.observe(to);
}

function updateCoordinates(): void {
  const [x1, y1] = portCoordinates(props.connection.from.id);
  const [x2, y2] = portCoordinates(props.connection.to.id);
  coordinates.value = { x1, y1, x2, y2 };
}

const nodePositionSignature = computed(() => {
  const graph = props.viewModel.displayedGraph;
  const from = (graph.nodes.find((node) => node.id === props.connection.from.nodeId) as { position?: { x: number; y: number } } | undefined)?.position;
  const to = (graph.nodes.find((node) => node.id === props.connection.to.nodeId) as { position?: { x: number; y: number } } | undefined)?.position;
  return `${props.connection.from.id}:${from?.x}:${from?.y}|${props.connection.to.id}:${to?.x}:${to?.y}`;
});

watch(nodePositionSignature, async () => {
  await nextTick();
  updateCoordinates();
}, { immediate: true, flush: "post" });

onMounted(async () => {
  await nextTick();
  observeNodeSizes();
  updateCoordinates();
});
onBeforeUnmount(() => resizeObserver?.disconnect());

const path = computed(() => {
  const graph = props.viewModel.displayedGraph;
  const x1 = (coordinates.value.x1 + graph.panning.x) * graph.scaling;
  const y1 = (coordinates.value.y1 + graph.panning.y) * graph.scaling;
  const x2 = (coordinates.value.x2 + graph.panning.x) * graph.scaling;
  const y2 = (coordinates.value.y2 + graph.panning.y) * graph.scaling;
  const dx = 0.3 * Math.abs(x1 - x2);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
});
</script>

<template>
  <path class="baklava-connection" :d="path" />
</template>
