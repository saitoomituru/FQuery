<script setup lang="ts">
import { computed, ref } from "vue";
import type { GuiEventAbi, PluginPresentationRegistration } from "@fquery/ui-core";

/**
 * Add Node。registrationをcategory treeで表示し、検索でfuzzyに絞る。
 * 追加はnode.add.requestedとしてHost／sessionへ渡す（GUIはnodeを作らない）。
 */
const props = defineProps<{ registrations: readonly PluginPresentationRegistration[] }>();
const emit = defineEmits<{ event: [event: GuiEventAbi] }>();
const query = ref("");
const collapsed = ref<Set<string>>(new Set());
let requestSequence = 0;

const matches = computed(() => {
  const needle = query.value.trim().toLocaleLowerCase();
  if (!needle) return props.registrations;
  return props.registrations.filter((registration) => [
    registration.capability,
    registration.pluginId,
    registration.presentation.category,
    registration.presentation.visualRole,
    ...(registration.presentation.aliases ?? []),
  ].some((value) => value?.toLocaleLowerCase().includes(needle)));
});

const groups = computed(() => {
  const byCategory = new Map<string, PluginPresentationRegistration[]>();
  for (const registration of matches.value) {
    const category = registration.presentation.category ?? "Plugin";
    byCategory.set(category, [...(byCategory.get(category) ?? []), registration]);
  }
  return [...byCategory.entries()]
    .sort(([left], [right]) => (left === "Core" ? -1 : right === "Core" ? 1 : left.localeCompare(right)))
    .map(([category, entries]) => ({ category, entries }));
});

function toggle(category: string) {
  const next = new Set(collapsed.value);
  if (next.has(category)) next.delete(category); else next.add(category);
  collapsed.value = next;
}

function requestAdd(registration: PluginPresentationRegistration) {
  requestSequence += 1;
  emit("event", {
    type: "node.add.requested",
    requestId: `ui:add:${requestSequence}`,
    capability: registration.capability,
    presentationRef: registration.presentation.presentationId,
  });
}

function label(registration: PluginPresentationRegistration): string {
  return registration.presentation.aliases?.[0] ?? registration.capability;
}
</script>

<template>
  <aside class="fquery-palette" aria-label="Plugin node palette">
    <label>
      Add Node検索
      <input v-model="query" type="search" placeholder="capability / category / alias" />
    </label>
    <p v-if="groups.length === 0" class="fquery-palette-muted">一致するnodeなし</p>
    <section v-for="group in groups" :key="group.category" class="fquery-palette-group" :data-category="group.category" :data-collapsed="collapsed.has(group.category) && !query ? 'true' : 'false'">
      <button type="button" class="fquery-palette-group-toggle" :aria-expanded="collapsed.has(group.category) && !query ? 'false' : 'true'" @click="toggle(group.category)">
        {{ collapsed.has(group.category) && !query ? "▸" : "▾" }} {{ group.category }} <small>({{ group.entries.length }})</small>
      </button>
      <ul v-if="!(collapsed.has(group.category) && !query)">
        <li v-for="registration in group.entries" :key="`${registration.pluginId}:${registration.capability}`">
          <button type="button" :data-capability="registration.capability" :title="`${registration.pluginId}@${registration.pluginVersion}`" @click="requestAdd(registration)">
            <strong>{{ label(registration) }}</strong>
            <span>{{ registration.capability }}</span>
          </button>
        </li>
      </ul>
    </section>
  </aside>
</template>

<style scoped>
.fquery-palette { display: grid; gap: 0.6rem; color: #eef2ff; }
.fquery-palette label { display: grid; gap: 0.35rem; color: #aeb8cc; font-size: 0.8rem; }
.fquery-palette input { color: inherit; background: #161b27; border: 1px solid #59647a; border-radius: 0.4rem; padding: 0.45rem; }
.fquery-palette-group { display: grid; gap: 0.3rem; }
.fquery-palette-group-toggle { color: #c9d5ed; background: transparent; border: 0; padding: 0.15rem 0; text-align: left; font-size: 0.8rem; font-weight: 600; }
.fquery-palette-group-toggle small { color: #8b98b4; font-weight: 400; }
.fquery-palette ul { display: grid; gap: 0.3rem; padding: 0 0 0 0.6rem; margin: 0; list-style: none; }
.fquery-palette li button { width: 100%; display: flex; justify-content: space-between; gap: 0.6rem; color: inherit; text-align: left; background: #252d40; border: 1px solid #59647a; border-radius: 0.4rem; padding: 0.45rem 0.55rem; }
.fquery-palette li button:focus-visible, .fquery-palette-group-toggle:focus-visible { outline: 3px solid #79c0ff; outline-offset: 2px; }
.fquery-palette span { color: #aeb8cc; font: 0.7rem ui-monospace, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fquery-palette-muted { margin: 0; color: #8b98b4; font-size: 0.8rem; }
</style>
