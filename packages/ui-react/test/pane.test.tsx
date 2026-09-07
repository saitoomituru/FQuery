import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaneRegistry, type PaneContext } from "@fquery/ui-core";
import { FQueryPane, type PaneSectionProps } from "../src/FQueryPane.js";

const Settings = ({ context }: PaneSectionProps) => <p className="settings">active: {context.activeNode?.label ?? "none"}</p>;
const Emitter = ({ onEvent }: PaneSectionProps) => <button type="button" className="emitter" onClick={() => onEvent({ type: "inspect", nodeId: "q://x" })}>go</button>;

function registry(): PaneRegistry {
  const pane = new PaneRegistry();
  pane.register({ side: "right", tab: { id: "node", title: "Node", order: 0 }, section: { id: "settings", title: "設定", order: 0 }, componentRef: "core:settings", source: "core" });
  pane.register({ side: "right", tab: { id: "node", title: "Node", order: 0 }, section: { id: "host", title: "Host", order: 50 }, componentRef: "host:emitter", source: "host" });
  pane.register({ side: "right", tab: { id: "raw", title: "RAW FAM", order: 40 }, section: { id: "famvim", title: "FAMVIM", order: 0, collapsible: false }, componentRef: "core:missing", source: "core" });
  return pane;
}

const context: PaneContext = { selection: { nodeIds: ["q://x"], activeNodeId: "q://x" }, activeNode: { nodeId: "q://x", label: "X", badges: [], ports: [], value: null, evidenceRefs: [], canExecute: false, canCancel: false } };
const noop = () => {};

afterEach(cleanup);

describe("FQueryPane", () => {
  beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

  it("tab stripとsection stackを描画し、componentRefをHostのmapで解決する", () => {
    const events: unknown[] = [];
    const { container } = render(<FQueryPane side="right" tabs={registry().resolve("right", context)} components={{ "core:settings": Settings, "host:emitter": Emitter }} context={context} open onEvent={(event) => events.push(event)} onOpenChange={noop} />);
    expect([...container.querySelectorAll('[role="tab"]')].map((tab) => tab.getAttribute("data-pane-tab"))).toEqual(["node", "raw"]);
    expect([...container.querySelectorAll("[data-pane-section]")].map((section) => section.getAttribute("data-pane-section"))).toEqual(["settings", "host"]);
    expect(container.querySelector(".settings")?.textContent).toContain("active: X");
    fireEvent.click(container.querySelector(".emitter")!);
    expect(events[0]).toMatchObject({ type: "inspect", nodeId: "q://x" });
  });

  it("未解決componentRefはsection宣言を保持したままfallbackを表示する", () => {
    const { container } = render(<FQueryPane side="right" tabs={registry().resolve("right", context)} components={{}} context={context} open onEvent={noop} onOpenChange={noop} />);
    fireEvent.click(container.querySelector('[data-pane-tab="raw"]')!);
    expect(container.querySelector('[data-pane-section="famvim"]')?.textContent).toContain("componentRef未解決");
    expect(container.querySelector('[data-pane-section="famvim"] .fquery-pane-section-toggle')).toBeNull();
  });

  it("section折り畳みと最終tabをlocalStorageへ残し、閉じるrequestを返す", () => {
    const onOpenChange = vi.fn();
    const props = { side: "right" as const, tabs: registry().resolve("right", context), components: { "core:settings": Settings }, context, open: true, storageKey: "test.pane", onEvent: noop, onOpenChange };
    const first = render(<FQueryPane {...props} />);
    fireEvent.click(first.container.querySelector('[data-pane-section="settings"] .fquery-pane-section-toggle')!);
    expect(first.container.querySelector('[data-pane-section="settings"]')?.getAttribute("data-collapsed")).toBe("true");
    expect(first.container.querySelector(".settings")).toBeNull();
    fireEvent.click(first.container.querySelector('[data-pane-tab="raw"]')!);
    expect(localStorage.getItem("test.pane.right.tab")).toBe("raw");
    expect(localStorage.getItem("test.pane.right.collapsed")).toBe("settings");
    first.unmount();
    const remounted = render(<FQueryPane {...props} />);
    expect(remounted.container.querySelector('[data-pane-tab="raw"]')?.getAttribute("aria-selected")).toBe("true");
    fireEvent.click(remounted.container.querySelector(".fquery-pane-close")!);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("activeTab propでHostがtabを切り替え、ユーザー操作はonActiveTabChangeで返る", () => {
    const onActiveTabChange = vi.fn();
    const { container } = render(<FQueryPane side="right" tabs={registry().resolve("right", context)} components={{}} context={context} open activeTab="raw" onEvent={noop} onOpenChange={noop} onActiveTabChange={onActiveTabChange} />);
    expect(container.querySelector('[data-pane-tab="raw"]')?.getAttribute("aria-selected")).toBe("true");
    fireEvent.click(container.querySelector('[data-pane-tab="node"]')!);
    expect(onActiveTabChange).toHaveBeenCalledWith("node");
  });

  it("tabが消えたらactive tabを先頭へ戻し、openがfalseならhidden", () => {
    const tabs = registry().resolve("right", context);
    const view = render(<FQueryPane side="left" tabs={tabs} components={{}} context={context} open onEvent={noop} onOpenChange={noop} />);
    fireEvent.click(view.container.querySelector('[data-pane-tab="raw"]')!);
    view.rerender(<FQueryPane side="left" tabs={tabs.slice(0, 1)} components={{}} context={context} open onEvent={noop} onOpenChange={noop} />);
    expect(view.container.querySelector('[data-pane-tab="node"]')?.getAttribute("aria-selected")).toBe("true");
    view.rerender(<FQueryPane side="left" tabs={tabs.slice(0, 1)} components={{}} context={context} open={false} onEvent={noop} onOpenChange={noop} />);
    expect(view.container.querySelector(".fquery-pane")?.hasAttribute("hidden")).toBe(true);
  });
});
