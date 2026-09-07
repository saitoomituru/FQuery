import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLiteralDecompositionFam } from "@fquery/fam-core";
import App from "../src/App.vue";

afterEach(() => vi.unstubAllGlobals());

describe("FQuery Playground", () => {
  it("複数provider/modelを発見し、選択routeで分解する", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { provider: "fixture", label: "Fixture", available: true, models: ["mock-fam-transformer"] },
        { provider: "gemini", label: "Gemini", available: true, models: ["gemini-2.5-flash-lite"], credentialName: "gemini-local" },
        { provider: "ollama", label: "Ollama Local", available: true, models: ["qwen3:8b", "mistral:7b"] },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { value: createLiteralDecompositionFam("自然言語テスト", "q://test/playground") }, events: [{ eventType: "result", status: "result" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.text()).toContain("FQUERY NODE EDITOR");
    expect(wrapper.get('[aria-label="FQuery node panel"]').attributes("data-node-id")).toContain("q://playground/node/1");
    expect(wrapper.findAll("select")[0]?.findAll("option")).toHaveLength(3);
    await wrapper.findAll("select")[0]!.setValue("ollama");
    expect(wrapper.findAll("select")[1]!.element.value).toBe("qwen3:8b");
    await wrapper.get('[aria-label="route controls"] button').trigger("click");
    await flushPromises();
    expect(fetcher).toHaveBeenLastCalledWith("/api/decompose", expect.objectContaining({ method: "POST" }));
    expect(wrapper.get('[data-record-kind="fam"]').text()).toContain("fam.json/0.1.0-draft");
    expect(wrapper.get('[data-record-kind="fam"]').text()).toContain("ψ");
    expect(wrapper.get('[data-record-kind="semantic-projection"]').text()).toContain("未生成");
    expect(wrapper.get('[data-record-kind="debug-event"]').text()).toContain("result");
    // Node editorが主表示、recordsは補助表示として後段に置く
    const records = wrapper.get('[aria-label="FQuery records"]').element;
    const editor = wrapper.get('[aria-label="FQuery Baklava presentation"]').element;
    expect(editor.compareDocumentPosition(records) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("pluginなしでCore 3 nodeをΨ→∇φ→λへ接続し、分解結果を∇φ.FAMVIMへ投影する", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ provider: "fixture", label: "Fixture", available: true, models: ["mock-fam-transformer"] }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { value: createLiteralDecompositionFam("自然言語テスト", "q://test/playground"), transport_status: "succeeded", plugin_status: "resolved", resolution_status: "resolved", connection_status: "connected" }, events: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const wrapper = mount(App);
    await flushPromises();
    const switches = wrapper.findAll('[aria-label="node selection"] button');
    expect(switches.map((button) => button.text())).toEqual(["Ψ.NL", "∇φ.FAMVIM", "λ.NL"]);
    expect(wrapper.findAll('[data-decision-status="accepted"]')).toHaveLength(8);
    const palette = wrapper.get('[aria-label="Plugin node palette"]');
    expect(palette.findAll("li")).toHaveLength(3);

    await wrapper.get('[aria-label="route controls"] button').trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-record-kind="provider-receipt"]').text()).toContain("succeeded");

    await switches[1]!.trigger("click");
    await wrapper.get('[data-tab="connections"]').trigger("click");
    expect(wrapper.findAll('.fquery-node-panel-ports li[data-connection="connected"]')).toHaveLength(2);
    await switches[2]!.trigger("click");
    await wrapper.get('[data-tab="connections"]').trigger("click");
    expect(wrapper.get('.fquery-node-panel-ports li[data-direction="output"]').attributes("data-connection")).toBe("unconnected");

    await palette.get("button").trigger("click");
    await flushPromises();
    expect(wrapper.findAll('[aria-label="node selection"] button')).toHaveLength(4);
  });
});

describe("FQuery Playground FAMVIM", () => {
  it("FAMVIM編集がfam.patch requestとしてHostへ渡りcanonical FAMがunknown fieldを保持したまま更新される", async () => {
    const famWithExtension = { ...createLiteralDecompositionFam("自然言語テスト", "q://test/playground"), "x-plugin-extension": { retained: true } };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ provider: "fixture", label: "Fixture", available: true, models: ["mock-fam-transformer"] }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { value: famWithExtension, transport_status: "succeeded", plugin_status: "resolved" }, events: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const wrapper = mount(App);
    await flushPromises();
    await wrapper.get('[aria-label="route controls"] button').trigger("click");
    await flushPromises();
    await wrapper.findAll('[aria-label="node selection"] button')[1]!.trigger("click");
    const panel = wrapper.get('[aria-label="FQuery node panel"]');
    expect(panel.attributes("data-node-id")).toContain("q://playground/node/2");
    await panel.get('[data-tab="unsupported"]').trigger("click");
    await panel.get('[data-jump="/x-plugin-extension/retained"]').trigger("click");
    const famvim = wrapper.get('[aria-label="FAMVIM RAW FAM editor"]');
    expect(famvim.get('[data-pointer="/x-plugin-extension/retained"]').attributes("data-unsupported")).toBe("true");
    const textarea = famvim.get("textarea");
    await textarea.setValue(textarea.element.value.replace("\"source-decomposition\"", "\"edited-purpose\""));
    await famvim.get("footer button").trigger("click");
    await flushPromises();
    expect(wrapper.get('[data-record-kind="fam"]').text()).toContain("edited-purpose");
    expect(wrapper.get('[data-record-kind="fam"]').text()).toContain("x-plugin-extension");
    expect(wrapper.get('[aria-label="fam edit receipts"]').text()).toContain("applied");
    expect(wrapper.findAll('[data-decision-status="accepted"]').length).toBeGreaterThanOrEqual(9);

    const famvimAfter = wrapper.get('[aria-label="FAMVIM RAW FAM editor"]');
    await famvimAfter.get("textarea").setValue("{ broken");
    await famvimAfter.get("footer button").trigger("click");
    await flushPromises();
    expect(wrapper.get('[aria-label="session decisions"]').text()).toContain("fam-text-unparsed");
    expect(wrapper.get('[data-record-kind="fam"]').text()).toContain("edited-purpose");

    // Ψ.NLへ戻すとdecomposer inspectorが設定tabに現れる
    await wrapper.findAll('[aria-label="node selection"] button')[0]!.trigger("click");
    await flushPromises();
    expect(wrapper.get('[aria-label="FQuery node panel"]').attributes("data-node-id")).toContain("q://playground/node/1");
    expect(wrapper.get('[aria-label="FQuery node panel"]').text()).toContain("fquery.core@");
    expect(wrapper.get('[aria-label="FQuery node panel"] [aria-label="route controls"]').exists()).toBe(true);
  });
});
