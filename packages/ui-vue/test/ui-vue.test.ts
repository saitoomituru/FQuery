import { flushPromises, mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { defineComponent } from "vue";
import type { NodeViewModel, PluginPresentationRegistration } from "@fquery/ui-core";
import FQueryNode from "../src/FQueryNode.vue";
import FQueryBaklavaView from "../src/FQueryBaklavaView.vue";
import FQueryPalette from "../src/FQueryPalette.vue";
import FQueryPanel from "../src/FQueryPanel.vue";
import FQueryRecordsPanel from "../src/FQueryRecordsPanel.vue";

const model: NodeViewModel = {
  nodeId: "q://test/vue",
  label: "Q test",
  badges: [
    { axis: "connection", value: "unconnected", tone: "notice" },
    { axis: "semantic", value: "unknown", tone: "unknown" },
  ],
  ports: [
    { portId: "in", label: "input", direction: "input", connectionStatus: "connected" },
    { portId: "out", label: "output", direction: "output", connectionStatus: "unconnected" },
  ],
  value: null,
  evidenceRefs: [],
  canExecute: true,
  canCancel: false,
  presentation: {
    targetRef: "q://test/vue",
    mode: "ghost",
    rendererId: "vue",
    reason: "plugin-unavailable",
  },
};

describe("FQueryNode", () => {
  it("直交statusとunconnected portを別属性で描画する", () => {
    const wrapper = mount(FQueryNode, { props: { model } });
    expect(wrapper.get('[data-axis="connection"]').attributes("data-tone")).toBe("notice");
    expect(wrapper.get('[data-axis="semantic"]').attributes("data-tone")).toBe("unknown");
    expect(wrapper.get('[data-direction="output"]').attributes("data-connection")).toBe("unconnected");
  });

  it("typed inspect eventをHostへ渡す", async () => {
    const wrapper = mount(FQueryNode, { props: { model } });
    await wrapper.get("header button").trigger("click");
    expect(wrapper.emitted("event")?.[0]).toEqual([{ type: "inspect", nodeId: "q://test/vue" }]);
  });

  it("実行状態に応じてbuttonを無効化する", () => {
    const wrapper = mount(FQueryNode, { props: { model } });
    const buttons = wrapper.findAll("footer button");
    expect(buttons[1]?.attributes("disabled")).toBeUndefined();
    expect(buttons[2]?.attributes("disabled")).toBeDefined();
  });

  it("plugin消失をghost nodeとして表示する", () => {
    const wrapper = mount(FQueryNode, { props: { model } });
    expect(wrapper.get('[data-presentation-mode="ghost"]').text()).toContain("plugin-unavailable");
  });
});

describe("FQueryPanel", () => {
  it("repositoryのmock fixtureだけでnodeを描画する", () => {
    const fixture = JSON.parse(readFileSync(join(process.cwd(), "../../fixtures/ui/node-view-model.json"), "utf8")) as { nodes: NodeViewModel[] };
    const wrapper = mount(FQueryPanel, { props: { nodes: fixture.nodes } });
    expect(wrapper.get('[data-node-id="q://fixture/ui/unconnected"]')).toBeTruthy();
  });
});

const registration: PluginPresentationRegistration = {
  pluginId: "sensor",
  pluginVersion: "1.0.0",
  capability: "sensor.force-torque",
  presentation: {
    schemaVersion: "fquery.presentation-fam/0.1.0-draft",
    presentationId: "presentation://sensor/default",
    targetRef: "capability://sensor.force-torque",
    surfaces: ["node-palette", "add-node-search"],
    visualRole: "sensor",
    interfaceRoles: ["source"],
    visibility: "visible",
    category: "Sensor",
    aliases: ["torque"],
  },
};

describe("FQueryPalette", () => {
  it("plugin presentationを検索しnode追加requestへ変換する", async () => {
    const wrapper = mount(FQueryPalette, { props: { registrations: [registration] } });
    await wrapper.get('input[type="search"]').setValue("torque");
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("event")?.[0]?.[0]).toMatchObject({
      type: "node.add.requested",
      capability: "sensor.force-torque",
      presentationRef: "presentation://sensor/default",
    });
  });
});

describe("FQueryRecordsPanel", () => {
  it("FAM・projection・FAMLog・receipt・debugを別recordへ描画する", () => {
    const wrapper = mount(FQueryRecordsPanel, {
      props: {
        semanticProjection: { schema_version: "fquery.semantic-block-projection/0.1.0-draft" },
        providerReceipt: { provider: "fixture" },
        debugEvents: [{ eventType: "result" }],
      },
    });
    expect(wrapper.findAll("[data-record-kind]")).toHaveLength(5);
    expect(wrapper.get('[data-record-kind="fam"]').text()).toContain("NOT IMPLEMENTED");
    expect(wrapper.get('[data-record-kind="semantic-projection"]').text()).toContain("semantic-block-projection");
    expect(wrapper.get('[data-record-kind="provider-receipt"]').text()).toContain("fixture");
    expect(wrapper.get('[data-record-kind="debug-event"]').text()).toContain("result");
  });
});

describe("FQueryBaklavaView", () => {
  it("明示height内にnodeを描画する", () => {
    const wrapper = mount(FQueryBaklavaView, {
      props: { nodes: [model], layout: [{ nodeId: model.nodeId, x: 40, y: 30 }] },
    });
    expect(wrapper.get(".fquery-baklava")).toBeTruthy();
    expect(wrapper.get(".baklava-node").text()).toContain("Q test");
  });
});

describe("FQueryBaklavaView reactivity", () => {
  it("mount後に追加されたnodeもcanvasへ描画される", async () => {
    const wrapper = mount(FQueryBaklavaView, { props: { nodes: [], nodeRenderers: {} } });
    expect(wrapper.findAll(".baklava-node:not(.--palette)")).toHaveLength(0);
    await wrapper.setProps({ nodes: [model] });
    await flushPromises();
    expect(wrapper.findAll(".baklava-node:not(.--palette)")).toHaveLength(1);
    await wrapper.setProps({ nodes: [] });
    await flushPromises();
    expect(wrapper.findAll(".baklava-node:not(.--palette)")).toHaveLength(0);
  });
});

describe("FQueryBaklavaView layout", () => {
  it("mount後に届いたlayoutが描画positionへ反映される", async () => {
    const wrapper = mount(FQueryBaklavaView, { props: { nodes: [model], layout: [], nodeRenderers: {} } });
    await wrapper.setProps({ layout: [{ nodeId: model.nodeId, x: 250, y: 90 }] });
    await flushPromises();
    const style = wrapper.get(".baklava-node:not(.--palette)").attributes("style") ?? "";
    expect(style).toContain("left: 250px");
    expect(style).toContain("top: 90px");
  });
});

describe("FQueryBaklavaView viewport", () => {
  it("viewportCenterをgraph座標で返し、zoomToFitがcommandとして実行できる", async () => {
    const wrapper = mount(FQueryBaklavaView, { props: { nodes: [model], layout: [{ nodeId: model.nodeId, x: 100, y: 50 }], nodeRenderers: {} } });
    await flushPromises();
    const handle = wrapper.vm as unknown as { viewportCenter(): { x: number; y: number }; zoomToFit(): boolean };
    const center = handle.viewportCenter();
    expect(Number.isFinite(center.x) && Number.isFinite(center.y)).toBe(true);
    expect(typeof handle.zoomToFit()).toBe("boolean");
  });
});

describe("FQueryBaklavaView selection", () => {
  const second: NodeViewModel = { ...model, nodeId: "q://test/vue2", label: "Q2", ports: [] };

  it("session selectionをBaklava selectedNodesへ反映し、Baklava側の変化をnode.select.requestedへ変換する", async () => {
    const wrapper = mount(FQueryBaklavaView, { props: { nodes: [model, second], nodeRenderers: {}, selection: { nodeIds: [] } } });
    await flushPromises();
    await wrapper.setProps({ selection: { nodeIds: [second.nodeId], activeNodeId: second.nodeId } });
    await flushPromises();
    expect(wrapper.get(`.baklava-node:not(.--palette)[data-node-type="fquery-projection:${second.nodeId}"]`).classes()).toContain("--selected");
    expect(wrapper.emitted("event") ?? []).toHaveLength(0);

    await wrapper.get(`.baklava-node:not(.--palette)[data-node-type="fquery-projection:${model.nodeId}"] .__title`).trigger("pointerdown");
    await flushPromises();
    const events = (wrapper.emitted("event") ?? []).map((entry) => entry[0] as { type: string; nodeIds?: string[]; activeNodeId?: string });
    const select = events.find((event) => event.type === "node.select.requested");
    expect(select).toMatchObject({ nodeIds: [model.nodeId], activeNodeId: model.nodeId });
  });
});

describe("FQueryCanvasNodeContent via FQueryBaklavaView", () => {
  const Custom = defineComponent({
    props: { model: { type: Object, required: true } },
    emits: ["event"],
    template: '<div class="custom-renderer">custom:{{ model.label }}<button type="button" @click="$emit(\'event\', { type: \'preview\', nodeId: model.nodeId })">go</button></div>',
  });
  const native = { targetRef: model.nodeId, mode: "native" as const, rendererId: "vue", presentation: { schemaVersion: "fquery.presentation-fam/0.1.0-draft" as const, presentationId: "p", targetRef: model.nodeId, surfaces: ["node-editor" as const], visualRole: "x", interfaceRoles: [], visibility: "visible" as const, rendererHint: "custom-hint" } };

  it("nativeなrendererHintに対応するplugin componentをnode本体へ描画しeventを転送する", async () => {
    const wrapper = mount(FQueryBaklavaView, {
      props: { nodes: [model], presentations: { [model.nodeId]: native }, nodeRenderers: { "custom-hint": Custom } },
    });
    const node = wrapper.get(".baklava-node:not(.--palette)");
    expect(node.get(".custom-renderer").text()).toContain("custom:Q test");
    expect(node.findAll(".baklava-node-interface.--input, .baklava-node-interface.--output").length).toBe(3);
    expect(node.findAll(".__port").length).toBe(2);
    await node.get(".custom-renderer button").trigger("click");
    expect(wrapper.emitted("event")?.[0]?.[0]).toMatchObject({ type: "preview", nodeId: model.nodeId });
  });

  it("renderer未登録／ghostはgeneric cardへfallbackしdataを表示する", () => {
    const wrapper = mount(FQueryBaklavaView, {
      props: { nodes: [{ ...model, value: { kept: true } }], presentations: { [model.nodeId]: { ...native, mode: "ghost", reason: "plugin-unavailable" } }, nodeRenderers: {} },
    });
    const node = wrapper.get(".baklava-node:not(.--palette)");
    expect(node.find(".custom-renderer").exists()).toBe(false);
    expect(node.get('[role="status"]').text()).toContain("ghost");
    expect(node.get(".fquery-canvas-node-value").text()).toContain("kept");
    expect(node.get('[data-axis="semantic"]').attributes("data-tone")).toBe("unknown");
  });
});
