import {
  PluginPresentationRegistry,
  PresentationSession,
  CORE_RENDERER_HINT,
  createCoreNodeViewModel,
  createFixtureDecisionPort,
  findCoreNodeContract,
  registerCoreNodes,
} from "@fquery/ui-core";

export const PLAYGROUND_RENDERER_ID = "react-flow";

/**
 * Host責務: sessionとregistryを構築する。GUIは判定を行わない。
 * Playgroundではengine不在のためfixture portが構造判定だけを返す。
 */
export function createPlaygroundSession(): PresentationSession {
  const registry = new PluginPresentationRegistry();
  registerCoreNodes(registry);
  return new PresentationSession(createFixtureDecisionPort({
    registry,
    renderer: { rendererId: PLAYGROUND_RENDERER_ID, supportedHints: [CORE_RENDERER_HINT] },
    nodeIdPrefix: "q://playground-react/node",
    createNode: (capability, nodeId) => {
      const contract = findCoreNodeContract(capability);
      if (!contract) throw new Error(`core-contract-not-found:${capability}`);
      return createCoreNodeViewModel(contract, nodeId);
    },
  }), { registry });
}
