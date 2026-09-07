<script setup lang="ts">
import { computed } from "vue";
import type { FQueryUiEvent, NodeViewModel, PresentationProjection } from "@fquery/ui-core";
import PsiNlNode from "./PsiNlNode.vue";
import FamvimNode from "./FamvimNode.vue";
import LambdaNlNode from "./LambdaNlNode.vue";

/** rendererHint `fquery-core-node` に対する1つのrenderer。presentationId（presentation://fquery/core/<capability>）でCore 3 nodeを振り分ける。 */
const props = defineProps<{ model: NodeViewModel; projection?: PresentationProjection | undefined }>();
const emit = defineEmits<{ event: [event: FQueryUiEvent] }>();

const capability = computed(() => props.projection?.presentation?.presentationId ?? "");
const component = computed(() => {
  if (capability.value.includes("core.psi.nl-input")) return PsiNlNode;
  if (capability.value.includes("core.gradient.famvim")) return FamvimNode;
  if (capability.value.includes("core.lambda.nl-output")) return LambdaNlNode;
  return undefined;
});
</script>

<template>
  <component :is="component" v-if="component" :model="model" :projection="projection" @event="emit('event', $event)" />
  <p v-else class="fquery-canvas-node-muted">renderer未対応: {{ capability }}</p>
</template>
