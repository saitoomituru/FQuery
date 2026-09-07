import { describe, expect, it } from "vitest";
import {
  CORE_NODE_CONTRACTS,
  CORE_PLUGIN_ID,
  PluginPresentationRegistry,
  PresentationSession,
  createCoreNodeViewModel,
  createFixtureDecisionPort,
  corePortId,
  findCoreNodeContract,
  registerCoreNodes,
  type PluginPresentationRegistration,
} from "../src/index.js";

const renderer = { rendererId: "vue", supportedHints: ["fquery-core-node"] };

function coreSession() {
  const registry = new PluginPresentationRegistry();
  registerCoreNodes(registry);
  const port = createFixtureDecisionPort({
    registry,
    renderer,
    createNode: (capability, nodeId) => createCoreNodeViewModel(findCoreNodeContract(capability)!, nodeId),
  });
  return new PresentationSession(port, { registry });
}

describe("Core nodes", () => {
  it("Ψ / ∇φ / λの3標準nodeだけをCore contractとして固定する", () => {
    expect(CORE_NODE_CONTRACTS.map((contract) => [contract.nodeType, contract.famRole])).toEqual([
      ["Ψ.NL", "ψ"],
      ["∇φ.FAMVIM", "∇φ"],
      ["λ.NL", "λ"],
    ]);
    expect(findCoreNodeContract("∇φ.FAMVIM")?.capability).toBe("core.gradient.famvim");
    expect(findCoreNodeContract("λ.NL")?.ports.find((port) => port.portKey === "fam")?.cardinality).toBe("many");
  });

  it("Core registrationはpixel layoutを持たずQ拡張をnode objectへ複製しない", () => {
    const registry = new PluginPresentationRegistry();
    registerCoreNodes(registry);
    const registrations = registry.registrations();
    expect(registrations).toHaveLength(3);
    for (const registration of registrations) {
      expect(registration.pluginId).toBe(CORE_PLUGIN_ID);
      expect(registration.presentation.category).toBe("Core");
      expect(registration.presentation).not.toHaveProperty("x");
    }
    const viewModel = createCoreNodeViewModel(CORE_NODE_CONTRACTS[1]!, "q://test/famvim");
    expect(viewModel).not.toHaveProperty("Q");
    expect(viewModel.value).toBeNull();
    expect(viewModel.ports.map((port) => port.portId)).toEqual([corePortId("q://test/famvim", "psi"), corePortId("q://test/famvim", "fam")]);
  });

  it("pluginゼロで3 node graphを構築しΨ→∇φ→λを接続できる", async () => {
    const session = coreSession();
    await session.dispatch({ type: "node.add.requested", requestId: "a1", capability: "core.psi.nl-input" });
    await session.dispatch({ type: "node.add.requested", requestId: "a2", capability: "core.gradient.famvim" });
    await session.dispatch({ type: "node.add.requested", requestId: "a3", capability: "core.lambda.nl-output" });
    const [psi, famvim, lambda] = session.state.nodes;
    await session.dispatch({ type: "connection.add.requested", requestId: "c1", fromPortId: corePortId(psi!.nodeId, "observation"), toPortId: corePortId(famvim!.nodeId, "psi") });
    const state = await session.dispatch({ type: "connection.add.requested", requestId: "c2", fromPortId: corePortId(famvim!.nodeId, "fam"), toPortId: corePortId(lambda!.nodeId, "fam") });
    expect(state.connections).toHaveLength(2);
    expect(state.nodes.every((node) => state.presentations[node.nodeId]?.mode === "native")).toBe(true);
    expect(state.nodes[1]!.ports.map((port) => port.connectionStatus)).toEqual(["connected", "connected"]);
  });

  it("optional plugin追加でCore registrationとcontractが変化しない", () => {
    const registry = new PluginPresentationRegistry();
    registerCoreNodes(registry);
    const before = JSON.stringify(registry.registrations());
    const optional: PluginPresentationRegistration = {
      pluginId: "plugin-voice",
      pluginVersion: "0.1.0",
      capability: "psi.voice",
      presentation: {
        schemaVersion: "fquery.presentation-fam/0.1.0-draft",
        presentationId: "presentation://plugin-voice/psi.voice",
        targetRef: "capability://psi.voice",
        surfaces: ["node-editor", "node-palette"],
        visualRole: "psi-input",
        interfaceRoles: ["observation"],
        visibility: "visible",
        category: "Ψ plugin",
      },
    };
    registry.register(optional);
    expect(registry.registrations().filter((registration) => registration.pluginId === CORE_PLUGIN_ID)).toHaveLength(3);
    expect(JSON.stringify(registry.registrations().filter((registration) => registration.pluginId === CORE_PLUGIN_ID))).toBe(before);
    expect(CORE_NODE_CONTRACTS).toHaveLength(3);
  });

  it("renderer非対応でもCore nodeはgenericとして意味参照を保つ", async () => {
    const registry = new PluginPresentationRegistry();
    registerCoreNodes(registry);
    const projection = registry.project({ targetRef: "q://x", capability: "core.psi.nl-input", renderer: { rendererId: "text", supportedHints: [] } });
    expect(projection.mode).toBe("generic");
    expect(projection.presentation?.presentationId).toBe("presentation://fquery/core/core.psi.nl-input");
  });
});

describe("Core node fixture", () => {
  it("fixtures/ui/core-nodes.jsonとCORE_NODE_CONTRACTSが一致する", async () => {
    const { readFileSync } = await import("node:fs");
    const fixture = JSON.parse(readFileSync(new URL("../../../fixtures/ui/core-nodes.json", import.meta.url), "utf8")) as {
      nodes: readonly { nodeType: string; famRole: string; capability: string; ports: readonly { portKey: string; direction: string; carries: string }[] }[];
    };
    expect(fixture.nodes.map((node) => ({ nodeType: node.nodeType, famRole: node.famRole, capability: node.capability, ports: node.ports })))
      .toEqual(CORE_NODE_CONTRACTS.map((contract) => ({ nodeType: contract.nodeType, famRole: contract.famRole, capability: contract.capability, ports: contract.ports.map((port) => ({ portKey: port.portKey, direction: port.direction, carries: port.carries })) })));
  });
});
