import { mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { NodeViewModel } from "@fquery/ui-core";
import FQueryNode from "../src/FQueryNode.vue";
import FQueryPanel from "../src/FQueryPanel.vue";

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
});

describe("FQueryPanel", () => {
  it("repositoryのmock fixtureだけでnodeを描画する", () => {
    const fixture = JSON.parse(readFileSync(join(process.cwd(), "../../fixtures/ui/node-view-model.json"), "utf8")) as { nodes: NodeViewModel[] };
    const wrapper = mount(FQueryPanel, { props: { nodes: fixture.nodes } });
    expect(wrapper.get('[data-node-id="q://fixture/ui/unconnected"]')).toBeTruthy();
  });
});
