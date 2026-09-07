import type { FamRole } from "./core-nodes.js";
import type { NodeViewModel, PluginPresentationRegistration, PresentationProjection } from "./index.js";
import type { NodeSelection } from "./session.js";

/**
 * 左Tool pane／右Inspector paneのslot式contribution（Issue #33）。
 * Blenderの`bl_region_type + bl_category`、ComfyUIの`registerSidebarTab`、
 * Node-REDの`RED.sidebar.addTab`に相当する宣言登録。
 *
 * ui-coreはVueを知らないので、componentは`componentRef`（Host／Viewが解決するkey）で参照する。
 * rendererHint→renderer componentと同じ経路。
 */
export type PaneSide = "left" | "right";

export interface PaneTabSpec {
  readonly id: string;
  readonly title: string;
  readonly icon?: string;
  readonly order: number;
}

export interface PaneSectionSpec {
  readonly id: string;
  readonly title: string;
  readonly order: number;
  readonly collapsible?: boolean;
}

/** contributionの適用可否を決める文脈。右paneはactive nodeに応じてsectionが出入りする。 */
export interface PaneContext {
  readonly activeNode?: NodeViewModel;
  readonly selection: NodeSelection;
  readonly registration?: PluginPresentationRegistration;
  readonly projection?: PresentationProjection;
  readonly famRole?: FamRole;
  readonly capability?: string;
}

export interface PaneContribution {
  readonly side: PaneSide;
  readonly tab: PaneTabSpec;
  readonly section: PaneSectionSpec;
  readonly componentRef: string;
  /** 由来（core / plugin:<id> / host）。receiptと衝突時の説明に使う */
  readonly source: string;
  readonly applies?: (context: PaneContext) => boolean;
}

/** plugin registrationが宣言する形。sideとcomponentRefは同じだが、`applies`は宣言的条件に限定する。 */
export interface PluginPaneContribution {
  readonly side: PaneSide;
  readonly tab: PaneTabSpec;
  readonly section: PaneSectionSpec;
  readonly componentRef: string;
  /** 省略時はそのpluginのnodeがactiveなときだけ適用 */
  readonly appliesTo?: "own-node" | "any-node" | "always";
}

export interface ResolvedPaneSection {
  readonly section: PaneSectionSpec;
  readonly componentRef: string;
  readonly source: string;
}

export interface ResolvedPaneTab {
  readonly tab: PaneTabSpec;
  readonly sections: readonly ResolvedPaneSection[];
}

export class PaneRegistry {
  readonly #contributions: PaneContribution[] = [];

  register(contribution: PaneContribution): () => void {
    validateContribution(contribution);
    const frozen = Object.freeze({ ...contribution });
    this.#contributions.push(frozen);
    return () => {
      const index = this.#contributions.indexOf(frozen);
      if (index >= 0) this.#contributions.splice(index, 1);
    };
  }

  /** plugin registrationの`editor.panes`を取り込む。戻り値で一括解除できる。 */
  registerPlugin(registration: PluginPresentationRegistration): () => void {
    const disposers = (registration.editor?.panes ?? []).map((pane) => this.register({
      side: pane.side,
      tab: pane.tab,
      section: pane.section,
      componentRef: pane.componentRef,
      source: `plugin:${registration.pluginId}`,
      applies: (context) => {
        const mode = pane.appliesTo ?? "own-node";
        if (mode === "always") return true;
        if (mode === "any-node") return context.activeNode !== undefined;
        return context.registration?.pluginId === registration.pluginId && context.registration.capability === registration.capability;
      },
    }));
    return () => { for (const dispose of disposers) dispose(); };
  }

  contributions(): readonly PaneContribution[] {
    return Object.freeze([...this.#contributions]);
  }

  /** sideとcontextで絞り、tab.idごとにsectionをstackして順序付ける。tab specは最小orderの宣言を採用する。 */
  resolve(side: PaneSide, context: PaneContext): readonly ResolvedPaneTab[] {
    const byTab = new Map<string, { tab: PaneTabSpec; sections: ResolvedPaneSection[] }>();
    for (const contribution of this.#contributions) {
      if (contribution.side !== side) continue;
      if (contribution.applies && !contribution.applies(context)) continue;
      const entry = byTab.get(contribution.tab.id) ?? { tab: contribution.tab, sections: [] };
      if (contribution.tab.order < entry.tab.order) entry.tab = contribution.tab;
      entry.sections.push({ section: contribution.section, componentRef: contribution.componentRef, source: contribution.source });
      byTab.set(contribution.tab.id, entry);
    }
    return Object.freeze([...byTab.values()]
      .sort((left, right) => left.tab.order - right.tab.order || left.tab.id.localeCompare(right.tab.id))
      .map((entry) => Object.freeze({
        tab: entry.tab,
        sections: Object.freeze([...entry.sections].sort((left, right) => left.section.order - right.section.order || left.section.id.localeCompare(right.section.id))),
      })));
  }
}

export function createPaneContext(input: {
  readonly selection: NodeSelection;
  readonly nodes: readonly NodeViewModel[];
  readonly presentations: Readonly<Record<string, PresentationProjection>>;
  readonly registrations: readonly PluginPresentationRegistration[];
}): PaneContext {
  const activeNode = input.nodes.find((node) => node.nodeId === input.selection.activeNodeId);
  const projection = activeNode ? input.presentations[activeNode.nodeId] : undefined;
  const registration = projection?.presentation
    ? input.registrations.find((candidate) => candidate.presentation.presentationId === projection.presentation?.presentationId)
    : undefined;
  return Object.freeze({
    selection: input.selection,
    ...(activeNode ? { activeNode } : {}),
    ...(projection ? { projection } : {}),
    ...(registration ? { registration } : {}),
    ...(registration?.editor?.famRole ? { famRole: registration.editor.famRole } : {}),
    ...(registration ? { capability: registration.capability } : {}),
  });
}

function validateContribution(contribution: PaneContribution): void {
  if (!contribution.tab.id || !contribution.section.id || !contribution.componentRef) throw new TypeError("pane contributionにはtab.id、section.id、componentRefが必要です");
  if (contribution.side !== "left" && contribution.side !== "right") throw new TypeError(`unsupported pane side: ${String(contribution.side)}`);
}
