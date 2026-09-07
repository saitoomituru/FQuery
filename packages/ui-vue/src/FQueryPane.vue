<script setup lang="ts">
import { computed, ref, watch, type Component } from "vue";
import type { FQueryUiEvent, PaneContext, PaneSide, ResolvedPaneTab } from "@fquery/ui-core";

/**
 * slot式pane（Issue #33）。左=Tool、右=Inspector。
 * tab strip → 縦stackされたsection（折り畳み可）。sectionの中身は`componentRef`をHostの
 * `components` mapで解決し、無ければgeneric fallbackを出す。GUI Coreは中身を解釈しない。
 * 開閉・最終tab・折り畳みはper-viewerの便宜としてlocalStorageへ残す。graph永続化ではない。
 */
const props = defineProps<{
  side: PaneSide;
  tabs: readonly ResolvedPaneTab[];
  components: Readonly<Record<string, Component>>;
  context: PaneContext;
  open: boolean;
  storageKey?: string | undefined;
  /** Hostからtabを指定する（例: Unsupported→RAWのjump）。指定後もユーザーは切り替えられる */
  activeTab?: string | undefined;
}>();
const emit = defineEmits<{ event: [event: FQueryUiEvent]; "update:open": [open: boolean]; "update:activeTab": [tabId: string] }>();

const key = computed(() => `${props.storageKey ?? "fquery.pane"}.${props.side}`);
const activeTabId = ref<string>(readStorage(`${key.value}.tab`) ?? "");
const collapsed = ref<Set<string>>(new Set((readStorage(`${key.value}.collapsed`) ?? "").split("|").filter(Boolean)));

const activeTab = computed(() => props.tabs.find((tab) => tab.tab.id === activeTabId.value) ?? props.tabs[0]);

watch(() => props.activeTab, (tabId) => { if (tabId && props.tabs.some((tab) => tab.tab.id === tabId)) activeTabId.value = tabId; }, { immediate: true });

watch(() => props.tabs.map((tab) => tab.tab.id).join("|"), () => {
  if (!props.tabs.some((tab) => tab.tab.id === activeTabId.value)) activeTabId.value = props.tabs[0]?.tab.id ?? "";
}, { immediate: true });

function selectTab(tabId: string) {
  activeTabId.value = tabId;
  writeStorage(`${key.value}.tab`, tabId);
  emit("update:activeTab", tabId);
}

function toggleSection(sectionId: string) {
  const next = new Set(collapsed.value);
  if (next.has(sectionId)) next.delete(sectionId); else next.add(sectionId);
  collapsed.value = next;
  writeStorage(`${key.value}.collapsed`, [...next].join("|"));
}

function readStorage(name: string): string | undefined {
  try { return typeof localStorage === "undefined" ? undefined : localStorage.getItem(name) ?? undefined; } catch { return undefined; }
}
function writeStorage(name: string, value: string): void {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(name, value); } catch { /* per-viewer便宜なので失敗は無視 */ }
}
</script>

<template>
  <aside class="fquery-pane" :data-side="side" :data-open="open ? 'true' : 'false'" :aria-label="`${side} pane`" :hidden="!open">
    <div class="fquery-pane-tabs" role="tablist" :aria-label="`${side} pane tabs`">
      <button
        v-for="entry in tabs"
        :key="entry.tab.id"
        type="button"
        role="tab"
        :data-pane-tab="entry.tab.id"
        :aria-selected="activeTab?.tab.id === entry.tab.id ? 'true' : 'false'"
        :title="entry.tab.title"
        @click="selectTab(entry.tab.id)"
      ><span v-if="entry.tab.icon" class="fquery-pane-icon" aria-hidden="true">{{ entry.tab.icon }}</span><span class="fquery-pane-tab-label">{{ entry.tab.title }}</span></button>
      <span class="fquery-pane-tabs-spacer" />
      <button type="button" class="fquery-pane-close" :aria-label="`close ${side} pane`" @click="emit('update:open', false)">×</button>
    </div>

    <div v-if="activeTab" class="fquery-pane-body" role="tabpanel" :data-pane-tab-panel="activeTab.tab.id">
      <section
        v-for="entry in activeTab.sections"
        :key="entry.section.id"
        class="fquery-pane-section"
        :data-pane-section="entry.section.id"
        :data-source="entry.source"
        :data-collapsed="collapsed.has(entry.section.id) ? 'true' : 'false'"
      >
        <header>
          <button
            v-if="entry.section.collapsible !== false"
            type="button"
            class="fquery-pane-section-toggle"
            :aria-expanded="collapsed.has(entry.section.id) ? 'false' : 'true'"
            @click="toggleSection(entry.section.id)"
          >{{ collapsed.has(entry.section.id) ? "▸" : "▾" }} {{ entry.section.title }}</button>
          <h4 v-else>{{ entry.section.title }}</h4>
          <small>{{ entry.source }}</small>
        </header>
        <div v-if="!collapsed.has(entry.section.id)" class="fquery-pane-section-body">
          <component :is="components[entry.componentRef]" v-if="components[entry.componentRef]" :context="context" @event="emit('event', $event)" />
          <p v-else class="fquery-pane-muted">componentRef未解決: <code>{{ entry.componentRef }}</code>（section宣言は保持）</p>
        </div>
      </section>
      <p v-if="activeTab.sections.length === 0" class="fquery-pane-muted">このtabに適用されるsectionはありません</p>
    </div>
    <p v-else class="fquery-pane-muted fquery-pane-empty">contributionなし</p>
  </aside>
</template>

<style scoped>
.fquery-pane { display: grid; grid-template-rows: auto minmax(0, 1fr); height: 100%; color: #eef2ff; background: #111724; border: 1px solid #34405a; border-radius: 0.6rem; overflow: hidden; }
.fquery-pane[hidden] { display: none; }
.fquery-pane-tabs { display: flex; gap: 0.15rem; align-items: stretch; border-bottom: 1px solid #34405a; background: #0d1117; overflow-x: auto; }
.fquery-pane-tabs button { color: #aeb8cc; background: transparent; border: 0; border-bottom: 2px solid transparent; padding: 0.45rem 0.6rem; white-space: nowrap; font-size: 0.8rem; }
.fquery-pane-tabs button[aria-selected="true"] { color: #79c0ff; border-bottom-color: #79c0ff; }
.fquery-pane-tabs button:focus-visible { outline: 3px solid #79c0ff; outline-offset: -3px; }
.fquery-pane-icon { margin-right: 0.3rem; }
.fquery-pane-tabs-spacer { flex: 1; }
.fquery-pane-close { font-size: 1rem; }
.fquery-pane-body { overflow: auto; padding: 0.5rem; display: grid; gap: 0.5rem; align-content: start; }
.fquery-pane-section { border: 1px solid #34405a; border-radius: 0.5rem; background: #161b27; }
.fquery-pane-section header { display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0.5rem; border-bottom: 1px solid #252d40; }
.fquery-pane-section[data-collapsed="true"] header { border-bottom: 0; }
.fquery-pane-section header h4 { margin: 0; font-size: 0.8rem; }
.fquery-pane-section header small { margin-left: auto; color: #8b98b4; font: 0.65rem ui-monospace, monospace; }
.fquery-pane-section-toggle { color: #c9d5ed; background: transparent; border: 0; padding: 0; font-size: 0.8rem; font-weight: 600; text-align: left; }
.fquery-pane-section-toggle:focus-visible { outline: 3px solid #79c0ff; outline-offset: 2px; }
.fquery-pane-section-body { padding: 0.5rem; }
.fquery-pane-muted { margin: 0; color: #8b98b4; font-size: 0.8rem; }
.fquery-pane-empty { padding: 0.75rem; }
</style>
