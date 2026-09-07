import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLiteralDecompositionFam } from "@fquery/fam-core";
import App from "../src/App.vue";

afterEach(() => vi.unstubAllGlobals());

const canvasNode = (wrapper: ReturnType<typeof mount>, index: number) => wrapper.findAll(".baklava-node:not(.--palette)")[index]!;
const openLeftTab = async (wrapper: ReturnType<typeof mount>, tab: string) => { await wrapper.get(`[aria-label="left pane"] [data-pane-tab="${tab}"]`).trigger("click"); };

describe("FQuery Playground", () => {
  it("複数provider/modelを発見し、Ψ.NL node内のdecomposerで分解する", async () => {
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
    const psi = canvasNode(wrapper, 0).get('[aria-label="route controls"]');
    expect(psi.findAll("select")[0]?.findAll("option")).toHaveLength(3);
    await psi.findAll("select")[0]!.setValue("ollama");
    expect(psi.findAll("select")[1]!.element.value).toBe("qwen3:8b");
    await psi.get("button").trigger("click");
    await flushPromises();
    expect(fetcher).toHaveBeenLastCalledWith("/api/decompose", expect.objectContaining({ method: "POST" }));
    await openLeftTab(wrapper, "records");
    expect(wrapper.get('[data-record-kind="fam"]').text()).toContain("fam.json/0.1.0-draft");
    expect(wrapper.get('[data-record-kind="fam"]').text()).toContain("ψ");
    expect(wrapper.get('[data-record-kind="semantic-projection"]').text()).toContain("未生成");
    expect(wrapper.get('[data-record-kind="debug-event"]').text()).toContain("result");
    // recordsは左Tool paneのtabであり、canvasの主表示を奪わない
    expect(wrapper.get('[aria-label="left pane"]').findAll('[role="tab"]').map((tab) => tab.attributes("data-pane-tab"))).toEqual(["add", "records", "decisions"]);
  });

  it("pluginなしでCore 3 nodeがcanvas内に中身付きで並び、分解結果が∇φ.FAMVIMとλ.NLへ投影される", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ provider: "fixture", label: "Fixture", available: true, models: ["mock-fam-transformer"] }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { value: createLiteralDecompositionFam("雨が降る。傘を持つ。", "q://test/playground"), transport_status: "succeeded", plugin_status: "resolved", resolution_status: "resolved", connection_status: "connected" }, events: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const wrapper = mount(App);
    await flushPromises();
    const nodes = wrapper.findAll(".baklava-node:not(.--palette)");
    expect(nodes).toHaveLength(3);
    expect(nodes.map((node) => node.attributes("data-node-type"))).toEqual(["fquery-projection:q://playground/node/1", "fquery-projection:q://playground/node/2", "fquery-projection:q://playground/node/3"]);
    expect(nodes.every((node) => node.get(".fquery-canvas-node").attributes("data-presentation-mode") === "native")).toBe(true);
    expect(nodes[0]!.find('[aria-label="route controls"]').exists()).toBe(true);
    expect(nodes[1]!.text()).toContain("canonical FAM未生成");
    expect(nodes[2]!.text()).toContain("NOT PROVIDED");
    await openLeftTab(wrapper, "decisions");
    expect(wrapper.findAll('[data-decision-status="accepted"]')).toHaveLength(8);
    await openLeftTab(wrapper, "add");
    expect(wrapper.get('[aria-label="Plugin node palette"]').findAll("li")).toHaveLength(3);

    await canvasNode(wrapper, 0).get('[aria-label="route controls"] button').trigger("click");
    await flushPromises();
    expect(canvasNode(wrapper, 0).get('[data-axis="transport"]').text()).toContain("succeeded");
    expect(canvasNode(wrapper, 0).get('[data-axis="semantic"]').text()).toContain("unknown");
    expect(canvasNode(wrapper, 1).text()).toContain("units=2");
    expect(canvasNode(wrapper, 2).text()).toContain("雨が降る。");
    expect(canvasNode(wrapper, 2).get('[data-axis="lambda"]').text()).toContain("unknown");

    await wrapper.get('[aria-label="Plugin node palette"] button').trigger("click");
    await flushPromises();
    expect(wrapper.findAll(".baklava-node:not(.--palette)")).toHaveLength(4);
  });
});

describe("FQuery Playground FAMVIM", () => {
  it("∇φ.FAMVIM nodeのRAW編集からinspectorを開き、fam.patchでcanonical FAMがunknown fieldを保持したまま更新される", async () => {
    const famWithExtension = { ...createLiteralDecompositionFam("自然言語テスト", "q://test/playground"), "x-plugin-extension": { retained: true } };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ provider: "fixture", label: "Fixture", available: true, models: ["mock-fam-transformer"] }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { value: famWithExtension, transport_status: "succeeded", plugin_status: "resolved" }, events: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const wrapper = mount(App);
    await flushPromises();
    expect(wrapper.get('[aria-label="right pane"]').attributes("hidden")).toBeDefined();
    await canvasNode(wrapper, 0).get('[aria-label="route controls"] button').trigger("click");
    await flushPromises();

    await canvasNode(wrapper, 1).get("button").trigger("click");
    await flushPromises();
    expect(wrapper.get('[aria-label="right pane"]').attributes("hidden")).toBeUndefined();
    expect(wrapper.get('[aria-label="right pane"]').find('[data-pane-section="decomposer"]').exists()).toBe(false);
    const panel = wrapper.get('[aria-label="FQuery node panel"]');
    expect(panel.attributes("data-node-id")).toContain("q://playground/node/2");
    expect(panel.get('[data-tab="raw"]').attributes("aria-selected")).toBe("true");
    const famvim = wrapper.get('[aria-label="FAMVIM RAW FAM editor"]');
    expect(famvim.get('[data-pointer="/x-plugin-extension/retained"]').exists()).toBe(true);
    const textarea = famvim.get("textarea");
    await textarea.setValue(textarea.element.value.replace("\"source-decomposition\"", "\"edited-purpose\""));
    await famvim.get("footer button").trigger("click");
    await flushPromises();
    await openLeftTab(wrapper, "records");
    expect(wrapper.get('[data-record-kind="fam"]').text()).toContain("edited-purpose");
    expect(wrapper.get('[data-record-kind="fam"]').text()).toContain("x-plugin-extension");
    await openLeftTab(wrapper, "decisions");
    expect(wrapper.get('[aria-label="fam edit receipts"]').text()).toContain("applied");

    const famvimAfter = wrapper.get('[aria-label="FAMVIM RAW FAM editor"]');
    await famvimAfter.get("textarea").setValue("{ broken");
    await famvimAfter.get("footer button").trigger("click");
    await flushPromises();
    expect(wrapper.get('[aria-label="session decisions"]').text()).toContain("fam-text-unparsed");
    await openLeftTab(wrapper, "records");
    expect(wrapper.get('[data-record-kind="fam"]').text()).toContain("edited-purpose");

    // Ψ.NLのinspectorボタンで対象が切り替わり、設定tabへ戻る。Ψ.NLではHostのdecomposer sectionがstackされる
    await canvasNode(wrapper, 0).findAll("button")[1]!.trigger("click");
    await flushPromises();
    expect(wrapper.get('[aria-label="FQuery node panel"]').attributes("data-node-id")).toContain("q://playground/node/1");
    expect(wrapper.get('[aria-label="FQuery node panel"]').text()).toContain("fquery.core@");
    const rightSections = wrapper.get('[aria-label="right pane"]').findAll("[data-pane-section]").map((section) => section.attributes("data-pane-section"));
    expect(rightSections).toEqual(["decomposer", "node-panel"]);

    // T / N で左右paneを開閉。入力中は無効
    await wrapper.get(".shell").trigger("keydown", { key: "n" });
    expect(wrapper.get('[aria-label="right pane"]').attributes("hidden")).toBeDefined();
    await wrapper.get(".shell").trigger("keydown", { key: "t" });
    expect(wrapper.get('[aria-label="left pane"]').attributes("hidden")).toBeDefined();
  });
});
