<script setup lang="ts">
import { computed, ref } from "vue";
import type { GuiEventAbi, PluginPresentationRegistration } from "@fquery/ui-core";

const props = defineProps<{ registrations: readonly PluginPresentationRegistration[] }>();
const emit = defineEmits<{ event: [event: GuiEventAbi] }>();
const query = ref("");
let requestSequence = 0;

const matches = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase();
  if (!needle) return props.registrations;
  return props.registrations.filter((registration) => [
    registration.capability,
    registration.presentation.category,
    registration.presentation.visualRole,
    ...(registration.presentation.aliases ?? []),
  ].some((value) => value?.toLocaleLowerCase().includes(needle)));
});

function requestAdd(registration: PluginPresentationRegistration) {
  requestSequence += 1;
  emit("event", {
    type: "node.add.requested",
    requestId: `ui:add:${requestSequence}`,
    capability: registration.capability,
    presentationRef: registration.presentation.presentationId,
  });
}
</script>

<template>
  <aside class="fquery-palette" aria-label="Plugin node palette">
    <label>
      Add Node検索
      <input v-model="query" type="search" placeholder="capability / category / alias" />
    </label>
    <ul>
      <li v-for="registration in matches" :key="`${registration.pluginId}:${registration.capability}`">
        <button type="button" @click="requestAdd(registration)">
          <strong>{{ registration.presentation.category ?? "Plugin" }}</strong>
          <span>{{ registration.capability }}</span>
        </button>
      </li>
    </ul>
  </aside>
</template>

<style scoped>
.fquery-palette { display: grid; gap: 0.75rem; padding: 1rem; color: #eef2ff; background: #111724; border: 1px solid #34405a; border-radius: 0.75rem; }
.fquery-palette label { display: grid; gap: 0.35rem; color: #aeb8cc; }
.fquery-palette input { color: inherit; background: #161b27; border: 1px solid #59647a; border-radius: 0.4rem; padding: 0.5rem; }
.fquery-palette ul { display: grid; gap: 0.4rem; padding: 0; margin: 0; list-style: none; }
.fquery-palette button { width: 100%; display: flex; justify-content: space-between; gap: 1rem; color: inherit; text-align: left; background: #252d40; border: 1px solid #59647a; border-radius: 0.4rem; padding: 0.55rem; }
.fquery-palette span { color: #aeb8cc; font-family: ui-monospace, monospace; }
</style>
