import type { PluginPresentationRegistration } from "@fquery/ui-core";

interface Props {
  readonly registrations: readonly PluginPresentationRegistration[];
  readonly onAdd: (capability: string, presentationRef: string) => void;
}

/** Add Node。registryの登録だけを列挙し、追加はrequestとしてHostへ返す。 */
export function AddNodePanel({ registrations, onAdd }: Props) {
  return (
    <section className="panel" aria-label="add node">
      <h2>Add Node</h2>
      <ul className="add-node-list">
        {registrations.map((registration) => (
          <li key={`${registration.pluginId}:${registration.capability}`}>
            <button type="button" onClick={() => onAdd(registration.capability, registration.presentation.presentationId)}>
              {registration.presentation.aliases?.[0] ?? registration.capability}
              <small>{registration.presentation.category ?? registration.pluginId}</small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
