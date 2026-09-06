import { mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
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
