import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLiteralDecompositionFam } from "@fquery/fam-core";
import { App } from "../src/App.js";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const fixtureRoutes = [{ provider: "fixture", label: "Fixture", available: true, models: ["mock-fam-transformer"] }];
const canvasNodes = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>(".fquery-flow-node")];
const leftPane = (container: HTMLElement) => container.querySelector<HTMLElement>('[aria-label="left pane"]')!;
const rightPane = (container: HTMLElement) => container.querySelector<HTMLElement>('[aria-label="right pane"]')!;
const openLeftTab = (container: HTMLElement, tab: string) => fireEvent.click(leftPane(container).querySelector(`[data-pane-tab="${tab}"]`)!);
const setText = (element: Element, value: string) => fireEvent.change(element, { target: { value } });

async function mountWithGraph(fetcher: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetcher);
  const view = render(<App />);
  await waitFor(() => expect(canvasNodes(view.container)).toHaveLength(3));
  return view;
}

describe("FQuery Playground", () => {
  it("複数provider/modelを発見し、Ψ.NL node内のdecomposerで分解する", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json([
        ...fixtureRoutes,
        { provider: "gemini", label: "Gemini", available: true, models: ["gemini-2.5-flash-lite"], credentialName: "gemini-local" },
        { provider: "ollama", label: "Ollama Local", available: true, models: ["qwen3:8b", "mistral:7b"] },
      ]))
      .mockResolvedValueOnce(json({ result: { value: createLiteralDecompositionFam("自然言語テスト", "q://test/playground") }, events: [{ eventType: "result", status: "result" }] }));
    const { container } = await mountWithGraph(fetcher);
    expect(container.textContent).toContain("FQUERY NODE EDITOR");
    const psi = within(canvasNodes(container)[0]!).getByLabelText("route controls");
    await waitFor(() => expect(psi.querySelectorAll("select")[0]?.querySelectorAll("option")).toHaveLength(3));
    setText(psi.querySelectorAll("select")[0]!, "ollama");
    expect((psi.querySelectorAll("select")[1] as HTMLSelectElement).value).toBe("qwen3:8b");
    await act(async () => { fireEvent.click(psi.querySelector("button")!); });
    await waitFor(() => expect(fetcher).toHaveBeenLastCalledWith("/api/decompose", expect.objectContaining({ method: "POST" })));
    openLeftTab(container, "records");
    await waitFor(() => expect(container.querySelector('[data-record-kind="fam"]')?.textContent).toContain("fam.json/0.1.0-draft"));
    expect(container.querySelector('[data-record-kind="fam"]')?.textContent).toContain("ψ");
    expect(container.querySelector('[data-record-kind="semantic-projection"]')?.textContent).toContain("未生成");
    expect(container.querySelector('[data-record-kind="debug-event"]')?.textContent).toContain("result");
    // recordsは左Tool paneのtabであり、canvasの主表示を奪わない
    expect([...leftPane(container).querySelectorAll('[role="tab"]')].map((tab) => tab.getAttribute("data-pane-tab"))).toEqual(["add", "outline", "records", "decisions"]);
    // outlinerからの選択はsession selectionを通り、canvasのnodeとinspectorに反映される
    openLeftTab(container, "outline");
    fireEvent.click(container.querySelector('[data-node-id="q://playground/node/3"] .fquery-outliner-select')!);
    await waitFor(() => expect(container.querySelector('.fquery-outliner [data-node-id="q://playground/node/3"]')?.getAttribute("data-active")).toBe("true"));
    await waitFor(() => expect(canvasNodes(container)[2]?.getAttribute("data-selected")).toBe("true"));
    fireEvent.click(container.querySelector('[data-node-id="q://playground/node/3"] .fquery-outliner-focus')!);
  });

  it("pluginなしでCore 3 nodeがcanvas内に中身付きで並び、分解結果が∇φ.FAMVIMとλ.NLへ投影される", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json(fixtureRoutes))
      .mockResolvedValueOnce(json({ result: { value: createLiteralDecompositionFam("雨が降る。傘を持つ。", "q://test/playground"), transport_status: "succeeded", plugin_status: "resolved", resolution_status: "resolved", connection_status: "connected" }, events: [] }));
    const { container } = await mountWithGraph(fetcher);
    const nodes = canvasNodes(container);
    expect(nodes.map((node) => node.getAttribute("data-node-id"))).toEqual(["q://playground/node/1", "q://playground/node/2", "q://playground/node/3"]);
    expect(nodes.every((node) => node.querySelector(".fquery-canvas-node")?.getAttribute("data-presentation-mode") === "native")).toBe(true);
    expect(nodes[0]!.querySelector('[aria-label="route controls"]')).not.toBeNull();
    expect(nodes[1]!.textContent).toContain("canonical FAM未生成");
    expect(nodes[2]!.textContent).toContain("NOT PROVIDED");
    // λ.NLのmanifestationだけがunconnected。unconnected != failure
    const unconnected = [...container.querySelectorAll(".fquery-flow-port[data-connection-status='unconnected']")].map((port) => port.getAttribute("data-port-id"));
    expect(unconnected).toHaveLength(1);
    expect(unconnected[0]).toContain(":manifestation");
    openLeftTab(container, "decisions");
    await waitFor(() => expect(container.querySelectorAll('[data-decision-status="accepted"]')).toHaveLength(8));
    openLeftTab(container, "add");
    expect(container.querySelector('[aria-label="Plugin node palette"]')!.querySelectorAll("li")).toHaveLength(3);
    expect(container.querySelector('[aria-label="Plugin node palette"] [data-category="Core"]')).not.toBeNull();

    await act(async () => { fireEvent.click(canvasNodes(container)[0]!.querySelector('[aria-label="route controls"] button')!); });
    await waitFor(() => expect(canvasNodes(container)[0]!.querySelector('[data-axis="transport"]')?.textContent).toContain("succeeded"));
    expect(canvasNodes(container)[0]!.querySelector('[data-axis="semantic"]')?.textContent).toContain("unknown");
    expect(canvasNodes(container)[1]!.textContent).toContain("units=2");
    await waitFor(() => expect(canvasNodes(container)[2]!.textContent).toContain("雨が降る。"));
    expect(canvasNodes(container)[2]!.querySelector('[data-axis="lambda"]')?.textContent).toContain("unknown");

    fireEvent.click(container.querySelector('[aria-label="Plugin node palette"] [data-capability="core.gradient.famvim"]')!);
    await waitFor(() => expect(canvasNodes(container)).toHaveLength(4));
    // 新規nodeはHostがviewport中央へ配置し、layout write-backとしてsessionへ通る
    openLeftTab(container, "decisions");
    await waitFor(() => expect(container.querySelector('[aria-label="session decisions"]')?.textContent).toContain("playground:place:1 → accepted"));
    fireEvent.click(container.querySelector('[title="Frame all (Home)"]')!);
  });
});

describe("FQuery Playground FAMVIM", () => {
  it("∇φ.FAMVIM nodeのRAW編集からinspectorを開き、fam.patchでcanonical FAMがunknown fieldを保持したまま更新される", async () => {
    const famWithExtension = { ...createLiteralDecompositionFam("自然言語テスト", "q://test/playground"), "x-plugin-extension": { retained: true } };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json(fixtureRoutes))
      .mockResolvedValueOnce(json({ result: { value: famWithExtension, transport_status: "succeeded", plugin_status: "resolved" }, events: [] }));
    const { container } = await mountWithGraph(fetcher);
    expect(rightPane(container).hasAttribute("hidden")).toBe(true);
    await act(async () => { fireEvent.click(canvasNodes(container)[0]!.querySelector('[aria-label="route controls"] button')!); });
    await waitFor(() => expect(canvasNodes(container)[1]!.textContent).toContain("units="));

    fireEvent.click(canvasNodes(container)[1]!.querySelector("button")!);
    await waitFor(() => expect(rightPane(container).hasAttribute("hidden")).toBe(false));
    expect(rightPane(container).querySelector('[data-pane-section="decomposer"]')).toBeNull();
    await waitFor(() => expect(rightPane(container).querySelector('[data-pane-tab="raw"]')?.getAttribute("aria-selected")).toBe("true"));
    const panel = container.querySelector('[aria-label="FQuery node panel"]')!;
    expect(panel.getAttribute("data-node-id")).toContain("q://playground/node/2");
    expect(panel.getAttribute("data-only")).toBe("raw");
    const famvim = container.querySelector('[aria-label="FAMVIM RAW FAM editor"]')!;
    expect(famvim.querySelector('[data-pointer="/x-plugin-extension/retained"]')).not.toBeNull();
    const textarea = famvim.querySelector("textarea") as HTMLTextAreaElement;
    setText(textarea, textarea.value.replace("\"source-decomposition\"", "\"edited-purpose\""));
    await act(async () => { fireEvent.click(famvim.querySelector("footer button")!); });
    openLeftTab(container, "records");
    await waitFor(() => expect(container.querySelector('[data-record-kind="fam"]')?.textContent).toContain("edited-purpose"));
    expect(container.querySelector('[data-record-kind="fam"]')?.textContent).toContain("x-plugin-extension");
    openLeftTab(container, "decisions");
    expect(container.querySelector('[aria-label="fam edit receipts"]')?.textContent).toContain("accepted");
    expect(container.querySelector('[aria-label="fam edit receipts"]')?.textContent).toContain("rev://playground/fam-edit/1");

    // GUIはinvalid draftもrequestできるが、Coreがrejectしcanonical revisionを変更しない
    const invalidEditor = container.querySelector('[aria-label="FAMVIM RAW FAM editor"] textarea') as HTMLTextAreaElement;
    const invalidFam = JSON.parse(invalidEditor.value) as Record<string, unknown>;
    delete invalidFam.Q;
    setText(invalidEditor, JSON.stringify(invalidFam, null, 2));
    await act(async () => { fireEvent.click(container.querySelector('[aria-label="FAMVIM RAW FAM editor"] footer button')!); });
    openLeftTab(container, "decisions");
    await waitFor(() => expect(container.querySelector('[aria-label="fam edit receipts"]')?.textContent).toContain("rejected"));
    expect(container.querySelector('[aria-label="fam edit receipts"]')?.textContent).toContain("fam-validation-failed");
    openLeftTab(container, "records");
    expect(container.querySelector('[data-record-kind="fam"]')?.textContent).toContain("edited-purpose");

    const famvimAfter = container.querySelector('[aria-label="FAMVIM RAW FAM editor"]')!;
    setText(famvimAfter.querySelector("textarea")!, "{ broken");
    await act(async () => { fireEvent.click(famvimAfter.querySelector("footer button")!); });
    openLeftTab(container, "decisions");
    await waitFor(() => expect(container.querySelector('[aria-label="session decisions"]')?.textContent).toContain("fam-text-unparsed"));
    openLeftTab(container, "records");
    expect(container.querySelector('[data-record-kind="fam"]')?.textContent).toContain("edited-purpose");

    // Ψ.NLのinspectorボタンで対象が切り替わり、設定tabへ戻る。Ψ.NLではHostのdecomposer sectionがstackされる
    fireEvent.click(canvasNodes(container)[0]!.querySelectorAll("button")[1]!);
    await waitFor(() => expect(container.querySelector('[aria-label="FQuery node panel"]')?.getAttribute("data-node-id")).toContain("q://playground/node/1"));
    expect(container.querySelector('[aria-label="FQuery node panel"]')?.textContent).toContain("fquery.core@");
    expect([...rightPane(container).querySelectorAll('[role="tab"]')].map((tab) => tab.getAttribute("data-pane-tab"))).toEqual(["node", "q", "unsupported", "raw"]);
    expect([...rightPane(container).querySelectorAll("[data-pane-section]")].map((section) => section.getAttribute("data-pane-section"))).toEqual(["decomposer", "settings", "connections"]);

    // Unsupported Data → RAWへjumpすると pane tab が切り替わり、FAMVIMで該当pathが選択される
    fireEvent.click(rightPane(container).querySelector('[data-pane-tab="unsupported"]')!);
    fireEvent.click(rightPane(container).querySelector("[data-jump]")!);
    await waitFor(() => expect(rightPane(container).querySelector('[data-pane-tab="raw"]')?.getAttribute("aria-selected")).toBe("true"));
    await waitFor(() => expect(rightPane(container).querySelector('[aria-current="true"][data-pointer]')).not.toBeNull());

    // T / N で左右paneを開閉。入力中は無効
    fireEvent.keyDown(container.querySelector(".shell")!, { key: "n" });
    expect(rightPane(container).hasAttribute("hidden")).toBe(true);
    fireEvent.keyDown(container.querySelector(".shell")!, { key: "t" });
    expect(leftPane(container).hasAttribute("hidden")).toBe(true);
    fireEvent.keyDown(container.querySelector(".shell textarea")!, { key: "t" });
    expect(leftPane(container).hasAttribute("hidden")).toBe(true);
  });
});

describe("Core graph構築の冪等性", () => {
  it("StrictModeの二重effectでもCore 3 nodeが二重に構築されない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(fixtureRoutes)));
    const { container } = render(<StrictMode><App /></StrictMode>);
    await waitFor(() => expect(canvasNodes(container).length).toBeGreaterThanOrEqual(3));
    openLeftTab(container, "decisions");
    await waitFor(() => expect(container.querySelectorAll('[data-decision-status="accepted"]').length).toBeGreaterThanOrEqual(8));
    expect(canvasNodes(container)).toHaveLength(3);
  });
});

describe("nextFreeSlot", () => {
  it("既存nodeと重なる位置は下へずらす", async () => {
    const { nextFreeSlot } = await import("../src/host/core-graph.js");
    expect(nextFreeSlot([{ x: 420, y: 80 }], { x: 400, y: 100 })).toEqual({ x: 400, y: 460 });
    expect(nextFreeSlot([{ x: 0, y: 0 }], { x: 800, y: 100 })).toEqual({ x: 800, y: 100 });
  });
});
