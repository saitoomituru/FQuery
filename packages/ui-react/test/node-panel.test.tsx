import { cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateFamJson } from "@fquery/fam-core";
import { previewFamDraftPatch, openFamText, getAtPointer, type FamDraftPatch, type JsonValue } from "@fquery/fam-edit";
import type { NodeViewModel, PluginPresentationRegistration } from "@fquery/ui-core";
import { FQueryNodePanel } from "../src/FQueryNodePanel.js";

const fixtureText = readFileSync(join(process.cwd(), "../../fixtures/valid/fam-decomposition.json"), "utf8");
const fam = { ...(JSON.parse(fixtureText) as Record<string, unknown>), "x-plugin-extension": { retained: true } } as Record<string, unknown>;

function registration(pluginId: string, properties: Record<string, { type: "string" | "number" | "boolean" | "enum"; enum?: string[]; readOnly?: boolean }>): PluginPresentationRegistration {
  return {
    pluginId,
    pluginVersion: "0.1.0",
    capability: `gradient.${pluginId}`,
    presentation: { schemaVersion: "fquery.presentation-fam/0.1.0-draft", presentationId: `presentation://${pluginId}/default`, targetRef: `capability://gradient.${pluginId}`, surfaces: ["node-editor", "inspector"], visualRole: "editor", interfaceRoles: ["psi", "fam"], visibility: "visible" },
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

const openTab = (container: HTMLElement, tab: string) => fireEvent.click(container.querySelector(`[data-tab="${tab}"]`)!);
const setText = (input: Element, value: string) => { fireEvent.change(input, { target: { value } }); fireEvent.blur(input); };

afterEach(cleanup);

describe("FQueryNodePanel", () => {
  it("Q tabをqSchemaから生成し、変更をknown pathだけのfam.patchとしてrequestする", () => {
    const events: { property: string; value: FamDraftPatch }[] = [];
    const { container } = render(<FQueryNodePanel node={node} registration={pluginA} validate={validateFamJson} onEvent={(event) => events.push(event as never)} />);
    openTab(container, "q");
    expect([...container.querySelectorAll("[data-q-key]")].map((label) => label.getAttribute("data-q-key"))).toEqual(["observer_ref", "top_k", "mode"]);
    expect((container.querySelector('[data-q-key="observer_ref"] input') as HTMLInputElement).value).toBe("observer://fixture");
    setText(container.querySelector('[data-q-key="observer_ref"] input')!, "observer://edited");
    expect(events[0]?.property).toBe("fam.patch");
    expect(events[0]?.value.operations).toEqual([{ op: "set", path: "/Q/observer_ref", value: "observer://edited" }]);
    setText(container.querySelector('[data-q-key="top_k"] input')!, "5");
    expect(events[1]?.value.operations).toEqual([{ op: "insert", path: "/Q/top_k", value: 5 }]);
    const applied = previewFamDraftPatch(openFamText(JSON.stringify(fam)), events[1]!.value, { validate: validateFamJson });
    expect(applied.receipt.status).toBe("applied");
    expect(getAtPointer(applied.document.parse === "parsed" ? applied.document.value : null, "/x-plugin-extension/retained")).toBe(true);
  });

  it("Unsupported Dataにpanel外のfieldを列挙しRAWへjumpできる", () => {
    const { container } = render(<FQueryNodePanel node={node} registration={pluginA} onEvent={() => {}} />);
    openTab(container, "unsupported");
    const pointers = [...container.querySelectorAll("[data-jump]")].map((button) => button.getAttribute("data-jump"));
    expect(pointers).toContain("/x-plugin-extension/retained");
    expect(pointers).toContain("/Q/registry_ref");
    expect(pointers).toContain("/λ/purpose");
    expect(pointers).not.toContain("/Q/observer_ref");
    expect(pointers).not.toContain("/ψ/source_text");
    fireEvent.click(container.querySelector('[data-jump="/x-plugin-extension/retained"]')!);
    expect(container.querySelector('[data-tab="raw"]')?.getAttribute("aria-selected")).toBe("true");
    expect(container.querySelector('[data-pointer="/x-plugin-extension/retained"]')?.getAttribute("aria-current")).toBe("true");
    expect(container.querySelector('[data-pointer="/x-plugin-extension/retained"]')?.getAttribute("data-unsupported")).toBe("true");
  });

  it("plugin A→B切替で認識fieldが入れ替わってもcanonical FAMは同一のまま", () => {
    const events: { value: FamDraftPatch }[] = [];
    const view = render(<FQueryNodePanel node={node} registration={pluginA} onEvent={(event) => events.push(event as never)} />);
    openTab(view.container, "q");
    setText(view.container.querySelector('[data-q-key="observer_ref"] input')!, "observer://a");
    const afterA = previewFamDraftPatch(openFamText(JSON.stringify(fam)), events[0]!.value);
    const valueA = afterA.document.parse === "parsed" ? afterA.document.value : null;
    view.rerender(<FQueryNodePanel node={{ ...node, value: valueA }} registration={pluginB} onEvent={(event) => events.push(event as never)} />);
    expect(view.container.querySelector('[data-tab="settings"]')?.getAttribute("aria-selected")).toBe("true");
    openTab(view.container, "q");
    expect([...view.container.querySelectorAll("[data-q-key]")].map((label) => label.getAttribute("data-q-key"))).toEqual(["registry_ref", "enabled"]);
    fireEvent.click(view.container.querySelector('[data-q-key="enabled"] input')!);
    const afterB = previewFamDraftPatch(openFamText(JSON.stringify(valueA)), events[1]!.value, { validate: validateFamJson });
    const valueB = afterB.document.parse === "parsed" ? afterB.document.value : null;
    expect(getAtPointer(valueB, "/Q/observer_ref")).toBe("observer://a");
    expect(getAtPointer(valueB, "/Q/enabled")).toBe(true);
    expect(getAtPointer(valueB, "/x-plugin-extension/retained")).toBe(true);
    expect(Object.keys(valueB as Record<string, JsonValue>)).toEqual(Object.keys(fam));
    openTab(view.container, "unsupported");
    expect([...view.container.querySelectorAll("[data-jump]")].map((button) => button.getAttribute("data-jump"))).toContain("/Q/observer_ref");
  });

  it("ghost（registration無し）でもdataを保持しRAW FAMで編集できる", () => {
    const { container } = render(<FQueryNodePanel node={node} projection={{ targetRef: node.nodeId, mode: "ghost", rendererId: "react-flow", reason: "plugin-unavailable" }} onEvent={() => {}} />);
    expect(container.querySelector('[role="status"]')?.textContent).toContain("ghost");
    openTab(container, "q");
    expect(container.textContent).toContain("Q schemaを宣言していない");
    openTab(container, "unsupported");
    expect(container.querySelectorAll("[data-jump]").length).toBeGreaterThan(10);
    openTab(container, "raw");
    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea.value).toContain("x-plugin-extension");
    expect(textarea.disabled).toBe(false);
  });

  it("接続tabはportと接続を表示し切断requestだけをemitする", () => {
    const events: unknown[] = [];
    const { container } = render(<FQueryNodePanel node={node} registration={pluginA} connections={[{ connectionId: "c1", fromPortId: "q://other:out", toPortId: "q://test/panel:psi" }, { connectionId: "c2", fromPortId: "q://x:out", toPortId: "q://y:in" }]} onEvent={(event) => events.push(event)} />);
    openTab(container, "connections");
    expect(container.querySelectorAll(".fquery-node-panel-connections li")).toHaveLength(1);
    fireEvent.click(container.querySelector(".fquery-node-panel-connections button")!);
    expect(events[0]).toMatchObject({ type: "connection.remove.requested", connectionId: "c1" });
  });
});

describe("FQueryNodePanel only mode", () => {
  it("only指定で1 tab分だけを描画し、Unsupported→RAWはjump eventとしてHostへ委ねる", () => {
    const events: unknown[] = [];
    const { container } = render(<FQueryNodePanel node={node} registration={pluginA} only="unsupported" onEvent={(event) => events.push(event)} />);
    expect(container.querySelector('[role="tablist"]')).toBeNull();
    expect(container.querySelector("h3")).toBeNull();
    fireEvent.click(container.querySelector('[data-jump="/x-plugin-extension/retained"]')!);
    expect(events[0]).toEqual({ type: "jump", nodeId: node.nodeId, pointer: "/x-plugin-extension/retained" });
    const raw = render(<FQueryNodePanel node={node} registration={pluginA} only="raw" jumpPointer="/x-plugin-extension/retained" onEvent={() => {}} />);
    expect(raw.container.querySelector('[data-pointer="/x-plugin-extension/retained"]')?.getAttribute("aria-current")).toBe("true");
  });
});
