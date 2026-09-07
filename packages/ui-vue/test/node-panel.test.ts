import { mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateFamJson } from "@fquery/fam-core";
import { applyFamPatch, openFamText, getAtPointer, type FamPatch, type JsonValue } from "@fquery/fam-edit";
import type { NodeViewModel, PluginPresentationRegistration } from "@fquery/ui-core";
import FQueryNodePanel from "../src/FQueryNodePanel.vue";

const fixtureText = readFileSync(join(process.cwd(), "../../fixtures/valid/fam-decomposition.json"), "utf8");
const fam = { ...(JSON.parse(fixtureText) as Record<string, unknown>), "x-plugin-extension": { retained: true } } as Record<string, unknown>;

function registration(pluginId: string, properties: Record<string, { type: "string" | "number" | "boolean" | "enum"; enum?: string[]; readOnly?: boolean }>): PluginPresentationRegistration {
  return {
    pluginId,
    pluginVersion: "0.1.0",
    capability: `gradient.${pluginId}`,
    presentation: {
      schemaVersion: "fquery.presentation-fam/0.1.0-draft",
      presentationId: `presentation://${pluginId}/default`,
      targetRef: `capability://gradient.${pluginId}`,
      surfaces: ["node-editor", "inspector"],
      visualRole: "editor",
      interfaceRoles: ["psi", "fam"],
      visibility: "visible",
    },
    editor: { famRole: "∇φ", qSchema: { schemaVersion: "fquery.q-schema/0.1.0-draft", properties }, knownPointers: ["/ψ"] },
  };
}

const node: NodeViewModel = {
  nodeId: "q://test/panel",
  label: "∇φ.plugin",
  badges: [],
  ports: [
    { portId: "q://test/panel:psi", label: "ψ", direction: "input", connectionStatus: "connected" },
    { portId: "q://test/panel:fam", label: "FAM", direction: "output", connectionStatus: "unconnected" },
  ],
  value: fam,
  evidenceRefs: [],
  canExecute: false,
  canCancel: false,
};

const pluginA = registration("plugin-a", { observer_ref: { type: "string" }, top_k: { type: "number" }, mode: { type: "enum", enum: ["strict", "loose"] } });
const pluginB = registration("plugin-b", { registry_ref: { type: "string" }, enabled: { type: "boolean" } });

async function openTab(wrapper: ReturnType<typeof mount>, tab: string) {
  await wrapper.get(`[data-tab="${tab}"]`).trigger("click");
}

describe("FQueryNodePanel", () => {
  it("Q tabをqSchemaから生成し、変更をknown pathだけのfam.patchとしてrequestする", async () => {
    const wrapper = mount(FQueryNodePanel, { props: { node, registration: pluginA, validate: validateFamJson } });
    await openTab(wrapper, "q");
    expect(wrapper.findAll("[data-q-key]").map((label) => label.attributes("data-q-key"))).toEqual(["observer_ref", "top_k", "mode"]);
    expect(wrapper.get('[data-q-key="observer_ref"] input').element.value).toBe("observer://fixture");
    await wrapper.get('[data-q-key="observer_ref"] input').setValue("observer://edited");
    const setEvent = wrapper.emitted("event")![0]![0] as { property: string; value: FamPatch };
    expect(setEvent.property).toBe("fam.patch");
    expect(setEvent.value.operations).toEqual([{ op: "set", path: "/Q/observer_ref", value: "observer://edited" }]);
    await wrapper.get('[data-q-key="top_k"] input').setValue("5");
    const insertEvent = wrapper.emitted("event")![1]![0] as { value: FamPatch };
    expect(insertEvent.value.operations).toEqual([{ op: "insert", path: "/Q/top_k", value: 5 }]);
    const applied = applyFamPatch(openFamText(JSON.stringify(fam)), insertEvent.value, { validate: validateFamJson });
    expect(applied.receipt.status).toBe("applied");
    expect(getAtPointer(applied.document.parse === "parsed" ? applied.document.value : null, "/x-plugin-extension/retained")).toBe(true);
  });

  it("Unsupported Dataにpanel外のfieldを列挙しRAWへjumpできる", async () => {
    const wrapper = mount(FQueryNodePanel, { attachTo: document.body, props: { node, registration: pluginA } });
    await openTab(wrapper, "unsupported");
    const pointers = wrapper.findAll("[data-jump]").map((button) => button.attributes("data-jump"));
    expect(pointers).toContain("/x-plugin-extension/retained");
    expect(pointers).toContain("/Q/registry_ref");
    expect(pointers).toContain("/λ/purpose");
    expect(pointers).not.toContain("/Q/observer_ref");
    expect(pointers).not.toContain("/ψ/source_text");
    await wrapper.get('[data-jump="/x-plugin-extension/retained"]').trigger("click");
    expect(wrapper.get('[data-tab="raw"]').attributes("aria-selected")).toBe("true");
    expect(wrapper.get('[data-pointer="/x-plugin-extension/retained"]').attributes("aria-current")).toBe("true");
    expect(wrapper.get('[data-pointer="/x-plugin-extension/retained"]').attributes("data-unsupported")).toBe("true");
    wrapper.unmount();
  });

  it("plugin A→B切替で認識fieldが入れ替わってもcanonical FAMは同一のまま", async () => {
    const wrapper = mount(FQueryNodePanel, { props: { node, registration: pluginA } });
    await openTab(wrapper, "q");
    await wrapper.get('[data-q-key="observer_ref"] input').setValue("observer://a");
    const patchA = (wrapper.emitted("event")![0]![0] as { value: FamPatch }).value;
    const afterA = applyFamPatch(openFamText(JSON.stringify(fam)), patchA);
    const valueA = afterA.document.parse === "parsed" ? afterA.document.value : null;
    await wrapper.setProps({ node: { ...node, value: valueA }, registration: pluginB });
    expect(wrapper.get('[data-tab="settings"]').attributes("aria-selected")).toBe("true");
    await openTab(wrapper, "q");
    expect(wrapper.findAll("[data-q-key]").map((label) => label.attributes("data-q-key"))).toEqual(["registry_ref", "enabled"]);
    await wrapper.get('[data-q-key="enabled"] input').setChecked(true);
    const patchB = (wrapper.emitted("event")![1]![0] as { value: FamPatch }).value;
    const afterB = applyFamPatch(openFamText(JSON.stringify(valueA)), patchB, { validate: validateFamJson });
    const valueB = afterB.document.parse === "parsed" ? afterB.document.value : null;
    expect(getAtPointer(valueB, "/Q/observer_ref")).toBe("observer://a");
    expect(getAtPointer(valueB, "/Q/enabled")).toBe(true);
    expect(getAtPointer(valueB, "/x-plugin-extension/retained")).toBe(true);
    expect(Object.keys(valueB as Record<string, JsonValue>)).toEqual(Object.keys(fam));
    await openTab(wrapper, "unsupported");
    expect(wrapper.findAll("[data-jump]").map((button) => button.attributes("data-jump"))).toContain("/Q/observer_ref");
  });

  it("ghost（registration無し）でもdataを保持しRAW FAMで編集できる", async () => {
    const wrapper = mount(FQueryNodePanel, { props: { node, projection: { targetRef: node.nodeId, mode: "ghost", rendererId: "vue", reason: "plugin-unavailable" } } });
    expect(wrapper.get('[role="status"]').text()).toContain("ghost");
    await openTab(wrapper, "q");
    expect(wrapper.text()).toContain("Q schemaを宣言していない");
    await openTab(wrapper, "unsupported");
    expect(wrapper.findAll("[data-jump]").length).toBeGreaterThan(10);
    await openTab(wrapper, "raw");
    expect(wrapper.get("textarea").element.value).toContain("x-plugin-extension");
    expect(wrapper.get("textarea").attributes("disabled")).toBeUndefined();
  });

  it("接続tabはportと接続を表示し切断requestだけをemitする", async () => {
    const wrapper = mount(FQueryNodePanel, { props: { node, registration: pluginA, connections: [{ connectionId: "c1", fromPortId: "q://other:out", toPortId: "q://test/panel:psi" }, { connectionId: "c2", fromPortId: "q://x:out", toPortId: "q://y:in" }] } });
    await openTab(wrapper, "connections");
    expect(wrapper.findAll(".fquery-node-panel-connections li")).toHaveLength(1);
    await wrapper.get(".fquery-node-panel-connections button").trigger("click");
    expect(wrapper.emitted("event")![0]![0]).toMatchObject({ type: "connection.remove.requested", connectionId: "c1" });
  });
});

describe("FQueryNodePanel only mode", () => {
  it("only指定で1 tab分だけを描画し、Unsupported→RAWはjump eventとしてHostへ委ねる", async () => {
    const wrapper = mount(FQueryNodePanel, { props: { node, registration: pluginA, only: "unsupported" } });
    expect(wrapper.find('[role="tablist"]').exists()).toBe(false);
    expect(wrapper.find("h3").exists()).toBe(false);
    await wrapper.get('[data-jump="/x-plugin-extension/retained"]').trigger("click");
    expect(wrapper.emitted("event")?.[0]?.[0]).toEqual({ type: "jump", nodeId: node.nodeId, pointer: "/x-plugin-extension/retained" });
    const raw = mount(FQueryNodePanel, { attachTo: document.body, props: { node, registration: pluginA, only: "raw", jumpPointer: "/x-plugin-extension/retained" } });
    expect(raw.get('[data-pointer="/x-plugin-extension/retained"]').attributes("aria-current")).toBe("true");
    raw.unmount();
  });
});
