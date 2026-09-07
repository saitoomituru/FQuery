import { PaneRegistry, type PaneContext, type PluginPresentationRegistry } from "@fquery/ui-core";
import type { PaneComponentMap } from "@fquery/ui-react";
import {
  AddNodeSection,
  DecisionsSection,
  DecomposerSection,
  NodeConnectionsSection,
  NodeQSection,
  NodeRawSection,
  NodeSettingsSection,
  NodeUnsupportedSection,
  OutlinerSection,
  RecordsSection,
} from "../panes/sections.js";

/**
 * pane contribution（Issue #33）。左=Tool（Add Node / 階層 / Records / Decisions）、右=Inspector。
 * Coreのnode panelとHostのdecomposer sectionを同じregistryへ宣言し、pluginは
 * registration.editor.panesで同じ経路へ参加する。
 */
export function createPlaygroundPaneRegistry(registry: PluginPresentationRegistry): PaneRegistry {
  const panes = new PaneRegistry();
  const withActive = (context: PaneContext) => context.activeNode !== undefined;
  panes.register({ side: "left", tab: { id: "add", title: "Add Node", icon: "＋", order: 0 }, section: { id: "palette", title: "検索して追加", order: 0 }, componentRef: "host:add-node", source: "host" });
  panes.register({ side: "left", tab: { id: "outline", title: "階層", icon: "☷", order: 10 }, section: { id: "outliner", title: "Nodes", order: 0 }, componentRef: "host:outliner", source: "host" });
  panes.register({ side: "left", tab: { id: "records", title: "Records", icon: "▤", order: 20 }, section: { id: "records", title: "FAM / projection / FAMLog / receipt / debug", order: 0 }, componentRef: "host:records", source: "host" });
  panes.register({ side: "left", tab: { id: "decisions", title: "Decisions", icon: "≡", order: 30 }, section: { id: "decisions", title: "Session decisions / FAM edit receipts", order: 0 }, componentRef: "host:decisions", source: "host" });
  panes.register({ side: "right", tab: { id: "node", title: "Node", icon: "◈", order: 0 }, section: { id: "settings", title: "設定", order: 10 }, componentRef: "core:node-settings", source: "core", applies: withActive });
  panes.register({ side: "right", tab: { id: "node", title: "Node", icon: "◈", order: 0 }, section: { id: "connections", title: "接続", order: 20 }, componentRef: "core:node-connections", source: "core", applies: withActive });
  panes.register({ side: "right", tab: { id: "q", title: "Q", icon: "Q", order: 10 }, section: { id: "q-schema", title: "Q schema", order: 0 }, componentRef: "core:node-q", source: "core", applies: withActive });
  panes.register({ side: "right", tab: { id: "unsupported", title: "Unsupported Data", icon: "?", order: 20 }, section: { id: "unsupported", title: "panel外のcanonical field", order: 0 }, componentRef: "core:node-unsupported", source: "core", applies: withActive });
  panes.register({ side: "right", tab: { id: "raw", title: "RAW FAM", icon: "{}", order: 30 }, section: { id: "famvim", title: "∇φ.FAMVIM", order: 0, collapsible: false }, componentRef: "core:node-raw", source: "core", applies: withActive });
  panes.register({ side: "right", tab: { id: "node", title: "Node", icon: "◈", order: 0 }, section: { id: "decomposer", title: "Ψ.NL decomposer route", order: 0 }, componentRef: "host:decomposer", source: "host", applies: (context) => context.famRole === "ψ" });
  for (const registration of registry.registrations()) panes.registerPlugin(registration);
  return panes;
}

export const PANE_COMPONENTS: PaneComponentMap = {
  "host:add-node": AddNodeSection,
  "host:outliner": OutlinerSection,
  "host:records": RecordsSection,
  "host:decisions": DecisionsSection,
  "core:node-settings": NodeSettingsSection,
  "core:node-connections": NodeConnectionsSection,
  "core:node-q": NodeQSection,
  "core:node-unsupported": NodeUnsupportedSection,
  "core:node-raw": NodeRawSection,
  "host:decomposer": DecomposerSection,
};
