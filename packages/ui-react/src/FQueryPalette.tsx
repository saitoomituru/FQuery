import { useMemo, useRef, useState } from "react";
import type { GuiEventAbi, PluginPresentationRegistration } from "@fquery/ui-core";

export interface FQueryPaletteProps {
  readonly registrations: readonly PluginPresentationRegistration[];
  readonly onEvent: (event: GuiEventAbi) => void;
}

/**
 * Add Node。registrationをcategory treeで表示し、検索でfuzzyに絞る。
 * 追加はnode.add.requestedとしてHost／sessionへ渡す（GUIはnodeを作らない）。
 */
export function FQueryPalette({ registrations, onEvent }: FQueryPaletteProps) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const sequence = useRef(0);

  const groups = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const matches = needle ? registrations.filter((registration) => [
      registration.capability,
      registration.pluginId,
      registration.presentation.category,
      registration.presentation.visualRole,
      ...(registration.presentation.aliases ?? []),
    ].some((value) => value?.toLocaleLowerCase().includes(needle))) : registrations;
    const byCategory = new Map<string, PluginPresentationRegistration[]>();
    for (const registration of matches) {
      const category = registration.presentation.category ?? "Plugin";
      byCategory.set(category, [...(byCategory.get(category) ?? []), registration]);
    }
    return [...byCategory.entries()]
      .sort(([left], [right]) => (left === "Core" ? -1 : right === "Core" ? 1 : left.localeCompare(right)))
      .map(([category, entries]) => ({ category, entries }));
  }, [registrations, query]);

  function toggle(category: string) {
    const next = new Set(collapsed);
    if (next.has(category)) next.delete(category); else next.add(category);
    setCollapsed(next);
  }

  function requestAdd(registration: PluginPresentationRegistration) {
    sequence.current += 1;
    onEvent({ type: "node.add.requested", requestId: `ui:add:${sequence.current}`, capability: registration.capability, presentationRef: registration.presentation.presentationId });
  }

  return (
    <aside className="fquery-palette" aria-label="Plugin node palette">
      <label>
        Add Node検索
        <input type="search" placeholder="capability / category / alias" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      {groups.length === 0 && <p className="fquery-palette-muted">一致するnodeなし</p>}
      {groups.map((group) => {
        const isCollapsed = collapsed.has(group.category) && !query;
        return (
          <section key={group.category} className="fquery-palette-group" data-category={group.category} data-collapsed={isCollapsed ? "true" : "false"}>
            <button type="button" className="fquery-palette-group-toggle" aria-expanded={isCollapsed ? "false" : "true"} onClick={() => toggle(group.category)}>
              {isCollapsed ? "▸" : "▾"} {group.category} <small>({group.entries.length})</small>
            </button>
            {!isCollapsed && (
              <ul>
                {group.entries.map((registration) => (
                  <li key={`${registration.pluginId}:${registration.capability}`}>
                    <button type="button" data-capability={registration.capability} title={`${registration.pluginId}@${registration.pluginVersion}`} onClick={() => requestAdd(registration)}>
                      <strong>{registration.presentation.aliases?.[0] ?? registration.capability}</strong>
                      <span>{registration.capability}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </aside>
  );
}
