import { describe, expect, it } from "vitest";
import {
  PaneRegistry,
  createPaneContext,
  registerCoreNodes,
  PluginPresentationRegistry,
  type NodeViewModel,
  type PaneContext,
  type PluginPresentationRegistration,
} from "../src/index.js";

const node = (nodeId: string): NodeViewModel => ({ nodeId, label: nodeId, badges: [], ports: [], value: null, evidenceRefs: [], canExecute: false, canCancel: false });

const ragPlugin: PluginPresentationRegistration = {
  pluginId: "plugin-rag",
  pluginVersion: "0.1.0",
  capability: "gradient.rag",
  presentation: {
    schemaVersion: "fquery.presentation-fam/0.1.0-draft",
    presentationId: "presentation://plugin-rag/default",
    targetRef: "capability://gradient.rag",
    surfaces: ["node-editor"],
    visualRole: "retriever",
    interfaceRoles: [],
    visibility: "visible",
  },
  editor: {
    famRole: "∇φ",
    panes: [
      { side: "right", tab: { id: "node", title: "Node", order: 0 }, section: { id: "rag-store", title: "RAG store", order: 50 }, componentRef: "rag:store" },
      { side: "left", tab: { id: "library", title: "Library", order: 20 }, section: { id: "rag-corpora", title: "Corpora", order: 0 }, componentRef: "rag:corpora", appliesTo: "always" },
    ],
  },
};

const emptyContext: PaneContext = { selection: { nodeIds: [] } };

describe("PaneRegistry", () => {
  it("同じtab.idへ複数sourceのsectionをstackし、tab specは最小orderの宣言を採用する", () => {
    const registry = new PaneRegistry();
    registry.register({ side: "right", tab: { id: "node", title: "Node (host)", order: 10 }, section: { id: "host-extra", title: "Host", order: 90 }, componentRef: "host:extra", source: "host" });
    registry.register({ side: "right", tab: { id: "node", title: "Node", order: 0 }, section: { id: "settings", title: "設定", order: 0 }, componentRef: "core:settings", source: "core" });
    registry.register({ side: "right", tab: { id: "raw", title: "RAW FAM", order: 40 }, section: { id: "famvim", title: "FAMVIM", order: 0 }, componentRef: "core:famvim", source: "core" });
    const tabs = registry.resolve("right", emptyContext);
    expect(tabs.map((entry) => entry.tab.title)).toEqual(["Node", "RAW FAM"]);
    expect(tabs[0]!.sections.map((entry) => entry.section.id)).toEqual(["settings", "host-extra"]);
    expect(registry.resolve("left", emptyContext)).toHaveLength(0);
  });

  it("appliesでactive nodeに応じてsectionが出入りし、登録解除で消える", () => {
    const registry = new PaneRegistry();
    const dispose = registry.register({
      side: "right", tab: { id: "node", title: "Node", order: 0 }, section: { id: "psi-only", title: "Ψ", order: 0 }, componentRef: "host:psi", source: "host",
      applies: (context) => context.famRole === "ψ",
    });
    expect(registry.resolve("right", { ...emptyContext, famRole: "ψ" })).toHaveLength(1);
    expect(registry.resolve("right", { ...emptyContext, famRole: "λ" })).toHaveLength(0);
    dispose();
    expect(registry.resolve("right", { ...emptyContext, famRole: "ψ" })).toHaveLength(0);
  });

  it("plugin registrationのeditor.panesを取り込み、own-nodeは自pluginのnodeがactiveなときだけ適用する", () => {
    const registry = new PaneRegistry();
    const presentations = new PluginPresentationRegistry();
    registerCoreNodes(presentations);
    presentations.register(ragPlugin);
    const dispose = registry.registerPlugin(ragPlugin);
    const ragContext = createPaneContext({
      selection: { nodeIds: ["q://rag"], activeNodeId: "q://rag" },
      nodes: [node("q://rag")],
      presentations: { "q://rag": { targetRef: "q://rag", mode: "native", rendererId: "vue", presentation: ragPlugin.presentation } },
      registrations: presentations.registrations(),
    });
    expect(ragContext.registration?.pluginId).toBe("plugin-rag");
    expect(ragContext.famRole).toBe("∇φ");
    expect(registry.resolve("right", ragContext)[0]?.sections.map((entry) => entry.source)).toEqual(["plugin:plugin-rag"]);
    expect(registry.resolve("left", ragContext)[0]?.tab.id).toBe("library");
    expect(registry.resolve("right", emptyContext)).toHaveLength(0);
    expect(registry.resolve("left", emptyContext)).toHaveLength(1);
    dispose();
    expect(registry.contributions()).toHaveLength(0);
  });

  it("不正なcontributionは登録時に拒否する", () => {
    const registry = new PaneRegistry();
    expect(() => registry.register({ side: "right", tab: { id: "", title: "x", order: 0 }, section: { id: "s", title: "s", order: 0 }, componentRef: "c", source: "t" })).toThrow();
    expect(() => registry.register({ side: "middle" as "left", tab: { id: "t", title: "x", order: 0 }, section: { id: "s", title: "s", order: 0 }, componentRef: "c", source: "t" })).toThrow();
  });
});
