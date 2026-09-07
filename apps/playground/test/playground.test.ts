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
    expect(wrapper.text()).toContain("LOCALHOST / PROVIDER ROUTES");
    expect(wrapper.findAll("select")[0]?.findAll("option")).toHaveLength(3);
    await wrapper.findAll("select")[0]!.setValue("ollama");
    expect(wrapper.findAll("select")[1]!.element.value).toBe("qwen3:8b");
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(fetcher).toHaveBeenLastCalledWith("/api/decompose", expect.objectContaining({ method: "POST" }));
    expect(wrapper.get('[data-record-kind="fam"]').text()).toContain("fam.json/0.1.0-draft");
    expect(wrapper.get('[data-record-kind="fam"]').text()).toContain("ψ");
    expect(wrapper.get('[data-record-kind="semantic-projection"]').text()).toContain("未生成");
    expect(wrapper.get('[data-record-kind="debug-event"]').text()).toContain("result");
    const records = wrapper.get('[aria-label="FQuery records"]').element;
    const editor = wrapper.get('[aria-label="FQuery Baklava presentation"]').element;
    expect(records.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("pluginなしでCore 3 nodeをΨ→∇φ→λへ接続し、分解結果を∇φ.FAMVIMへ投影する", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ provider: "fixture", label: "Fixture", available: true, models: ["mock-fam-transformer"] }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { value: createLiteralDecompositionFam("自然言語テスト", "q://test/playground"), transport_status: "succeeded", plugin_status: "resolved", resolution_status: "resolved", connection_status: "connected" }, events: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetcher);
    const wrapper = mount(App);
    await flushPromises();
    const nodes = wrapper.findAll(".fquery-node");
    expect(nodes.map((node) => node.attributes("aria-label"))).toEqual(["Ψ.NL", "∇φ.FAMVIM", "λ.NL"]);
    expect(wrapper.findAll('[data-decision-status="accepted"]')).toHaveLength(8);
    expect(nodes[1]!.findAll('[data-connection="connected"]')).toHaveLength(2);
    expect(nodes[2]!.find('[data-direction="output"]').attributes("data-connection")).toBe("unconnected");
    const palette = wrapper.get('[aria-label="Plugin node palette"]');
    expect(palette.findAll("li")).toHaveLength(3);

    await wrapper.get('[aria-label="route controls"] button').trigger("click");
    await flushPromises();
    const psi = wrapper.findAll(".fquery-node")[0]!;
    expect(psi.get('[data-axis="transport"]').text()).toContain("succeeded");
    expect(psi.get('[data-axis="semantic"]').text()).toContain("unknown");
    const famvim = wrapper.findAll(".fquery-node")[1]!;
    expect(famvim.get('[data-axis="semantic"]').attributes("data-tone")).toBe("unknown");

    await palette.get("button").trigger("click");
    await flushPromises();
    expect(wrapper.findAll(".fquery-node")).toHaveLength(4);
  });
});
