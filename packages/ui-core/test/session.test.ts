import { describe, expect, it } from "vitest";
import {
  PluginPresentationRegistry,
  PresentationSession,
  applyPresentationDecision,
  createEmptySessionState,
  createFixtureDecisionPort,
  type NodeViewModel,
  type PluginPresentationRegistration,
  type PresentationDecisionPort,
} from "../src/index.js";

const renderer = { rendererId: "vue", supportedHints: ["fquery-node"] };

function registration(pluginId: string, capability: string, presentationId = `presentation://${pluginId}/${capability}`): PluginPresentationRegistration {
  return {
    pluginId,
    pluginVersion: "0.1.0",
    capability,
    presentation: {
      schemaVersion: "fquery.presentation-fam/0.1.0-draft",
      presentationId,
      targetRef: `capability://${capability}`,
      surfaces: ["node-editor", "node-palette"],
      visualRole: "operator",
      interfaceRoles: ["input", "output"],
      visibility: "visible",
      rendererHint: "fquery-node",
      category: "Test",
    },
  };
}

function node(nodeId: string, label = nodeId): NodeViewModel {
  return {
    nodeId,
    label,
    badges: [],
    ports: [
      { portId: `${nodeId}:input`, label: "input", direction: "input", connectionStatus: "unconnected" },
      { portId: `${nodeId}:output`, label: "output", direction: "output", connectionStatus: "unconnected" },
    ],
    value: null,
    evidenceRefs: [],
    canExecute: false,
    canCancel: false,
  };
}

function fixtureSession(): PresentationSession {
  const registry = new PluginPresentationRegistry();
  registry.register(registration("plugin-a", "fam.decompose"));
  const port = createFixtureDecisionPort({ registry, renderer, createNode: (capability, nodeId) => node(nodeId, capability) });
  return new PresentationSession(port, { registry });
}

async function twoNodes(session: PresentationSession) {
  await session.dispatch({ type: "node.add.requested", requestId: "add-1", capability: "fam.decompose" });
  await session.dispatch({ type: "node.add.requested", requestId: "add-2", capability: "fam.decompose" });
  const [first, second] = session.state.nodes;
  return { first: first!, second: second! };
}

describe("Presentation Session", () => {
  it("node.add requestはport判定がacceptedのときだけnodeとprojectionを生成する", async () => {
    const session = fixtureSession();
    const state = await session.dispatch({ type: "node.add.requested", requestId: "add-1", capability: "fam.decompose" });
    expect(state.nodes).toHaveLength(1);
    expect(state.presentations[state.nodes[0]!.nodeId]?.mode).toBe("native");
    expect(state.pending).toHaveLength(0);
    expect(state.decisions[0]).toMatchObject({ kind: "node.add", status: "accepted", evidenceRefs: ["plugin://plugin-a/fam.decompose"] });
  });

  it("plugin未登録capabilityはunresolvedとして記録しnodeを作らない", async () => {
    const session = fixtureSession();
    const state = await session.dispatch({ type: "node.add.requested", requestId: "add-x", capability: "sensor.unknown" });
    expect(state.nodes).toHaveLength(0);
    expect(state.decisions[0]).toMatchObject({ status: "unresolved", reason: "plugin-unavailable" });
  });

  it("接続acceptedでportがconnectedへ、unresolvedではunconnectedのまま残る", async () => {
    const session = fixtureSession();
    const { first, second } = await twoNodes(session);
    const unresolvedPort: PresentationDecisionPort = {
      decide: (request) => ({ kind: "connection.add", requestId: request.requestId, status: "unresolved", reason: "engine-pending", evidenceRefs: [] }),
    };
    const waiting = new PresentationSession(unresolvedPort, { initialState: session.state });
    const pendingState = await waiting.dispatch({ type: "connection.add.requested", requestId: "c-1", fromPortId: `${first.nodeId}:output`, toPortId: `${second.nodeId}:input` });
    expect(pendingState.connections).toHaveLength(0);
    expect(pendingState.nodes[1]!.ports[0]!.connectionStatus).toBe("unconnected");
    expect(pendingState.decisions.at(-1)).toMatchObject({ status: "unresolved" });

    const accepted = await session.dispatch({ type: "connection.add.requested", requestId: "c-2", fromPortId: `${first.nodeId}:output`, toPortId: `${second.nodeId}:input` });
    expect(accepted.connections).toHaveLength(1);
    expect(accepted.nodes[0]!.ports[1]!.connectionStatus).toBe("connected");
    expect(accepted.nodes[1]!.ports[0]!.connectionStatus).toBe("connected");
  });

  it("port方向不一致の接続はrejectedとして理由付きで残りconnectionを作らない", async () => {
    const session = fixtureSession();
    const { first, second } = await twoNodes(session);
    const state = await session.dispatch({ type: "connection.add.requested", requestId: "c-bad", fromPortId: `${first.nodeId}:input`, toPortId: `${second.nodeId}:input` });
    expect(state.connections).toHaveLength(0);
    expect(state.decisions.at(-1)).toMatchObject({ status: "rejected", reason: "port-direction-mismatch" });
  });

  it("connection.removeとnode.removeで関連portをunconnectedへ戻す", async () => {
    const session = fixtureSession();
    const { first, second } = await twoNodes(session);
    await session.dispatch({ type: "connection.add.requested", requestId: "c-1", fromPortId: `${first.nodeId}:output`, toPortId: `${second.nodeId}:input` });
    const connectionId = session.state.connections[0]!.connectionId;
    const removed = await session.dispatch({ type: "connection.remove.requested", requestId: "r-1", connectionId });
    expect(removed.connections).toHaveLength(0);
    expect(removed.nodes[0]!.ports[1]!.connectionStatus).toBe("unconnected");

    await session.dispatch({ type: "connection.add.requested", requestId: "c-2", fromPortId: `${first.nodeId}:output`, toPortId: `${second.nodeId}:input` });
    const afterNodeRemove = await session.dispatch({ type: "node.remove.requested", requestId: "n-1", nodeId: second.nodeId });
    expect(afterNodeRemove.nodes.map((entry) => entry.nodeId)).toEqual([first.nodeId]);
    expect(afterNodeRemove.connections).toHaveLength(0);
    expect(afterNodeRemove.nodes[0]!.ports[1]!.connectionStatus).toBe("unconnected");
    expect(afterNodeRemove.presentations[second.nodeId]).toBeUndefined();
  });

  it("node.moveはlayout write-backとしてPresentation FAMへ混入せず確定値だけ保持する", async () => {
    const session = fixtureSession();
    const { first } = await twoNodes(session);
    const state = await session.dispatch({ type: "node.move.requested", requestId: "m-1", nodeId: first.nodeId, layoutSlotRef: "layout://fixture/1", x: 40, y: 80 });
    expect(state.layout).toEqual([{ nodeId: first.nodeId, x: 40, y: 80 }]);
    expect(state.presentations[first.nodeId]?.presentation).not.toHaveProperty("x");
  });

  it("plugin消失でregistryから外れ既存nodeはghostとしてdataを保持する", async () => {
    const session = fixtureSession();
    const { first } = await twoNodes(session);
    const state = await session.dispatch({ type: "plugin.presentation.removed", pluginId: "plugin-a", capability: "fam.decompose" });
    expect(session.registry.registrations()).toHaveLength(0);
    expect(state.nodes).toHaveLength(2);
    expect(state.presentations[first.nodeId]).toMatchObject({ mode: "ghost", reason: "plugin-unavailable" });
    expect(state.presentations[first.nodeId]?.presentation?.presentationId).toBe("presentation://plugin-a/fam.decompose");
  });

  it("plugin discoveryはregistryへ登録しnodeを自動追加しない", async () => {
    const session = new PresentationSession({ decide: () => { throw new Error("must not decide"); } });
    const state = await session.dispatch({ type: "plugin.presentation.discovered", registration: registration("plugin-b", "fam.compose") });
    expect(session.registry.registrations()).toHaveLength(1);
    expect(state.nodes).toHaveLength(0);
  });

  it("property.changeはengineが返した置換nodeだけを投影しGUI側で値を計算しない", async () => {
    const session = fixtureSession();
    const { first, second } = await twoNodes(session);
    const state = await session.dispatch({ type: "property.change.requested", requestId: "p-1", targetRef: first.nodeId, property: "value", value: { edited: true } });
    expect(state.nodes[0]!.value).toEqual({ edited: true });
    expect(state.nodes[1]).toBe(second);
    const unresolved = await session.dispatch({ type: "property.change.requested", requestId: "p-2", targetRef: first.nodeId, property: "label", value: "x" });
    expect(unresolved.nodes[0]!.label).toBe(first.label);
    expect(unresolved.decisions.at(-1)).toMatchObject({ status: "unresolved", reason: "fixture-port-no-semantic-engine" });
  });

  it("requestIdが一致しないdecisionは拒否する", async () => {
    const session = new PresentationSession({ decide: () => ({ kind: "node.remove", requestId: "other", status: "accepted", nodeId: "n", evidenceRefs: [] }) });
    await expect(session.dispatch({ type: "node.remove.requested", requestId: "mine", nodeId: "n" })).rejects.toThrow("decision-request-mismatch");
  });

  it("applyPresentationDecisionは純粋関数として入力stateを変更しない", () => {
    const state = createEmptySessionState();
    const next = applyPresentationDecision(state, { kind: "node.add", requestId: "a", status: "accepted", node: node("q://x"), evidenceRefs: [] });
    expect(state.nodes).toHaveLength(0);
    expect(next.nodes).toHaveLength(1);
    expect(Object.isFrozen(next)).toBe(true);
  });

  it("subscribeでpending→decisionの順にstateが通知される", async () => {
    const session = fixtureSession();
    const seen: number[] = [];
    session.subscribe((state) => seen.push(state.pending.length));
    await session.dispatch({ type: "node.add.requested", requestId: "add-1", capability: "fam.decompose" });
    expect(seen).toEqual([1, 0]);
  });
});
