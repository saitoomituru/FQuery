import { useEffect, useMemo, useState, type ComponentType } from "react";
import type { FQueryUiEvent, PaneContext, PaneSide, ResolvedPaneTab } from "@fquery/ui-core";

export interface PaneSectionProps {
  readonly context: PaneContext;
  readonly onEvent: (event: FQueryUiEvent) => void;
}

export type PaneComponentMap = Readonly<Record<string, ComponentType<PaneSectionProps>>>;

export interface FQueryPaneProps {
  readonly side: PaneSide;
  readonly tabs: readonly ResolvedPaneTab[];
  readonly components: PaneComponentMap;
  readonly context: PaneContext;
  readonly open: boolean;
  readonly storageKey?: string | undefined;
  /** Hostからtabを指定する（例: Unsupported→RAWのjump）。指定後もユーザーは切り替えられる */
  readonly activeTab?: string | undefined;
  readonly onEvent: (event: FQueryUiEvent) => void;
  readonly onOpenChange: (open: boolean) => void;
  readonly onActiveTabChange?: ((tabId: string) => void) | undefined;
}

/**
 * slot式pane（Issue #33）。左=Tool、右=Inspector。
 * tab strip → 縦stackされたsection（折り畳み可）。sectionの中身は`componentRef`をHostの
 * `components` mapで解決し、無ければgeneric fallbackを出す。GUI Coreは中身を解釈しない。
 * 開閉・最終tab・折り畳みはper-viewerの便宜としてlocalStorageへ残す。graph永続化ではない。
 */
export function FQueryPane({ side, tabs, components, context, open, storageKey, activeTab, onEvent, onOpenChange, onActiveTabChange }: FQueryPaneProps) {
  const key = `${storageKey ?? "fquery.pane"}.${side}`;
  const [activeTabId, setActiveTabId] = useState<string>(() => activeTab ?? readStorage(`${key}.tab`) ?? "");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set((readStorage(`${key}.collapsed`) ?? "").split("|").filter(Boolean)));

  useEffect(() => {
    if (activeTab && tabs.some((tab) => tab.tab.id === activeTab)) setActiveTabId(activeTab);
  }, [activeTab, tabs]);

  const tabIds = tabs.map((tab) => tab.tab.id).join("|");
  useEffect(() => {
    // 現在のtabが消えたときだけ先頭へ戻す。Host指定（activeTab）が有効ならそれを優先する
    setActiveTabId((current) => tabs.some((tab) => tab.tab.id === current) ? current : activeTab && tabs.some((tab) => tab.tab.id === activeTab) ? activeTab : tabs[0]?.tab.id ?? "");
    // tabの集合が変わったときだけ再評価する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabIds]);

  const current = useMemo(() => tabs.find((tab) => tab.tab.id === activeTabId) ?? tabs[0], [tabs, activeTabId]);

  function selectTab(tabId: string) {
    setActiveTabId(tabId);
    writeStorage(`${key}.tab`, tabId);
    onActiveTabChange?.(tabId);
  }

  function toggleSection(sectionId: string) {
    const next = new Set(collapsed);
    if (next.has(sectionId)) next.delete(sectionId); else next.add(sectionId);
    setCollapsed(next);
    writeStorage(`${key}.collapsed`, [...next].join("|"));
  }

  return (
    <aside className="fquery-pane" data-side={side} data-open={open ? "true" : "false"} aria-label={`${side} pane`} hidden={!open}>
      <div className="fquery-pane-tabs" role="tablist" aria-label={`${side} pane tabs`}>
        {tabs.map((entry) => (
          <button
            key={entry.tab.id}
            type="button"
            role="tab"
            data-pane-tab={entry.tab.id}
            aria-selected={current?.tab.id === entry.tab.id ? "true" : "false"}
            title={entry.tab.title}
            onClick={() => selectTab(entry.tab.id)}
          >{entry.tab.icon && <span className="fquery-pane-icon" aria-hidden="true">{entry.tab.icon}</span>}<span className="fquery-pane-tab-label">{entry.tab.title}</span></button>
        ))}
        <span className="fquery-pane-tabs-spacer" />
        <button type="button" className="fquery-pane-close" aria-label={`close ${side} pane`} onClick={() => onOpenChange(false)}>×</button>
      </div>

      {current ? (
        <div className="fquery-pane-body" role="tabpanel" data-pane-tab-panel={current.tab.id}>
          {current.sections.map((entry) => {
            const isCollapsed = collapsed.has(entry.section.id);
            const Section = components[entry.componentRef];
            return (
              <section key={entry.section.id} className="fquery-pane-section" data-pane-section={entry.section.id} data-source={entry.source} data-collapsed={isCollapsed ? "true" : "false"}>
                <header>
                  {entry.section.collapsible !== false
                    ? <button type="button" className="fquery-pane-section-toggle" aria-expanded={isCollapsed ? "false" : "true"} onClick={() => toggleSection(entry.section.id)}>{isCollapsed ? "▸" : "▾"} {entry.section.title}</button>
                    : <h4>{entry.section.title}</h4>}
                  <small>{entry.source}</small>
                </header>
                {!isCollapsed && (
                  <div className="fquery-pane-section-body">
                    {Section
                      ? <Section context={context} onEvent={onEvent} />
                      : <p className="fquery-pane-muted">componentRef未解決: <code>{entry.componentRef}</code>（section宣言は保持）</p>}
                  </div>
                )}
              </section>
            );
          })}
          {current.sections.length === 0 && <p className="fquery-pane-muted">このtabに適用されるsectionはありません</p>}
        </div>
      ) : (
        <p className="fquery-pane-muted fquery-pane-empty">contributionなし</p>
      )}
    </aside>
  );
}

function readStorage(name: string): string | undefined {
  try { return typeof localStorage === "undefined" ? undefined : localStorage.getItem(name) ?? undefined; } catch { return undefined; }
}
function writeStorage(name: string, value: string): void {
  try { if (typeof localStorage !== "undefined") localStorage.setItem(name, value); } catch { /* per-viewer便宜なので失敗は無視 */ }
}
