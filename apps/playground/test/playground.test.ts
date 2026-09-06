import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
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
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { value: { schema_version: "fquery.candidate-fam/0.1.0-draft" } }, events: [{ eventType: "result", status: "result" }] }), { status: 200 }));
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
    expect(wrapper.get('[aria-label="candidate FAM"]').text()).toContain("fquery.candidate-fam/0.1.0-draft");
  });
});
