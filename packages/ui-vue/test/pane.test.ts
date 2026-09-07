import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { defineComponent } from "vue";
import { PaneRegistry, type PaneContext } from "@fquery/ui-core";
import FQueryPane from "../src/FQueryPane.vue";

const Settings = defineComponent({ props: { context: { type: Object, required: true } }, template: '<p class="settings">active: {{ context.activeNode?.label ?? "none" }}</p>' });
const Emitter = defineComponent({ emits: ["event"], template: '<button type="button" class="emitter" @click="$emit(\'event\', { type: \'inspect\', nodeId: \'q://x\' })">go</button>' });

function registry(): PaneRegistry {
  const pane = new PaneRegistry();
  pane.register({ side: "right", tab: { id: "node", title: "Node", order: 0 }, section: { id: "settings", title: "設定", order: 0 }, componentRef: "core:settings", source: "core" });
  pane.register({ side: "right", tab: { id: "node", title: "Node", order: 0 }, section: { id: "host", title: "Host", order: 50 }, componentRef: "host:emitter", source: "host" });
  pane.register({ side: "right", tab: { id: "raw", title: "RAW FAM", order: 40 }, section: { id: "famvim", title: "FAMVIM", order: 0, collapsible: false }, componentRef: "core:missing", source: "core" });
  return pane;
}

const context: PaneContext = { selection: { nodeIds: ["q://x"], activeNodeId: "q://x" }, activeNode: { nodeId: "q://x", label: "X", badges: [], ports: [], value: null, evidenceRefs: [], canExecute: false, canCancel: false } };

describe("FQueryPane", () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

  it("tab stripとsection stackを描画し、componentRefをHostのmapで解決する", async () => {
    const wrapper = mount(FQueryPane, { props: { side: "right", tabs: registry().resolve("right", context), components: { "core:settings": Settings, "host:emitter": Emitter }, context, open: true } });
    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.attributes("data-pane-tab"))).toEqual(["node", "raw"]);
    expect(wrapper.findAll("[data-pane-section]").map((section) => section.attributes("data-pane-section"))).toEqual(["settings", "host"]);
    expect(wrapper.get(".settings").text()).toContain("active: X");
    await wrapper.get(".emitter").trigger("click");
    expect(wrapper.emitted("event")?.[0]?.[0]).toMatchObject({ type: "inspect", nodeId: "q://x" });
  });

  it("未解決componentRefはsection宣言を保持したままfallbackを表示する", async () => {
    const wrapper = mount(FQueryPane, { props: { side: "right", tabs: registry().resolve("right", context), components: {}, context, open: true } });
    await wrapper.get('[data-pane-tab="raw"]').trigger("click");
    expect(wrapper.get('[data-pane-section="famvim"]').text()).toContain("componentRef未解決");
    expect(wrapper.get('[data-pane-section="famvim"]').find(".fquery-pane-section-toggle").exists()).toBe(false);
  });

  it("section折り畳みと最終tabをlocalStorageへ残し、閉じるrequestをemitする", async () => {
    const props = { side: "right" as const, tabs: registry().resolve("right", context), components: { "core:settings": Settings }, context, open: true, storageKey: "test.pane" };
    const wrapper = mount(FQueryPane, { props });
    await wrapper.get('[data-pane-section="settings"] .fquery-pane-section-toggle').trigger("click");
    expect(wrapper.get('[data-pane-section="settings"]').attributes("data-collapsed")).toBe("true");
    expect(wrapper.find(".settings").exists()).toBe(false);
    await wrapper.get('[data-pane-tab="raw"]').trigger("click");
    expect(localStorage.getItem("test.pane.right.tab")).toBe("raw");
    expect(localStorage.getItem("test.pane.right.collapsed")).toBe("settings");
    const remounted = mount(FQueryPane, { props });
    expect(remounted.get('[data-pane-tab="raw"]').attributes("aria-selected")).toBe("true");
    await remounted.get(".fquery-pane-close").trigger("click");
    expect(remounted.emitted("update:open")?.[0]).toEqual([false]);
  });

  it("activeTab propでHostがtabを切り替え、ユーザー操作はupdate:activeTabで返る", async () => {
    const wrapper = mount(FQueryPane, { props: { side: "right", tabs: registry().resolve("right", context), components: {}, context, open: true, activeTab: "raw" } });
    expect(wrapper.get('[data-pane-tab="raw"]').attributes("aria-selected")).toBe("true");
    await wrapper.get('[data-pane-tab="node"]').trigger("click");
    expect(wrapper.emitted("update:activeTab")?.[0]).toEqual(["node"]);
  });

  it("tabが消えたらactive tabを先頭へ戻し、openがfalseならhidden", async () => {
    const wrapper = mount(FQueryPane, { props: { side: "left", tabs: registry().resolve("right", context), components: {}, context, open: true } });
    await wrapper.get('[data-pane-tab="raw"]').trigger("click");
    await wrapper.setProps({ tabs: registry().resolve("right", context).slice(0, 1) });
    expect(wrapper.get('[data-pane-tab="node"]').attributes("aria-selected")).toBe("true");
    await wrapper.setProps({ open: false });
    expect(wrapper.get(".fquery-pane").attributes("hidden")).toBeDefined();
  });
});
