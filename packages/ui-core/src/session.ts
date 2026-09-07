import {
  PluginPresentationRegistry,
  applyEnginePresentationEvent,
  type ConnectionViewModel,
  type EnginePresentationEvent,
  type GuiEventAbi,
  type NodeViewModel,
  type PortViewModel,
  type PresentationProjection,
  type PresentationProjectionState,
} from "./index.js";

/**
 * GUI requestに対するengine側の判定。GUIは判定を計算せず、
 * `accepted`のときだけstateへ反映する。`unresolved`は失敗ではなく未確定。
 */
export type DecisionStatus = "accepted" | "rejected" | "unresolved";

interface DecisionBase {
  readonly requestId: string;
  readonly status: DecisionStatus;
  readonly reason?: string;
  readonly evidenceRefs: readonly string[];
}

export type PresentationDecision =
  | (DecisionBase & { readonly kind: "node.add"; readonly node?: NodeViewModel; readonly projection?: PresentationProjection })
  | (DecisionBase & { readonly kind: "node.remove"; readonly nodeId: string })
  | (DecisionBase & { readonly kind: "node.move"; readonly nodeId: string; readonly layout?: LayoutValue })
  | (DecisionBase & { readonly kind: "connection.add"; readonly connection?: ConnectionViewModel })
  | (DecisionBase & { readonly kind: "connection.remove"; readonly connectionId: string })
  | (DecisionBase & { readonly kind: "property.change"; readonly targetRef: string; readonly node?: NodeViewModel })
  | (DecisionBase & { readonly kind: "presentation.change"; readonly targetRef: string; readonly projection?: PresentationProjection });

/** layout write-backの確定値。Presentation FAMではなくHost layout storeの値。 */
export interface LayoutValue {
  readonly nodeId: string;
  readonly x: number;
  readonly y: number;
}

export type GuiRequest = Exclude<GuiEventAbi, { type: "plugin.presentation.discovered" | "plugin.presentation.removed" }>;

export interface PresentationSessionState extends PresentationProjectionState {
  readonly connections: readonly ConnectionViewModel[];
  readonly layout: readonly LayoutValue[];
  readonly pending: readonly GuiRequest[];
  readonly decisions: readonly PresentationDecision[];
}

/** engine／Hostが実装する判定port。GUIはこのport越しにしか状態を変更できない。 */
export interface PresentationDecisionPort {
  decide(request: GuiRequest, state: PresentationSessionState): PresentationDecision | Promise<PresentationDecision>;
}

export type PresentationSessionListener = (state: PresentationSessionState) => void;

export function createEmptySessionState(): PresentationSessionState {
  return Object.freeze({
    nodes: Object.freeze([]),
    presentations: Object.freeze({}),
    engineStates: Object.freeze({}),
    connections: Object.freeze([]),
    layout: Object.freeze([]),
    pending: Object.freeze([]),
    decisions: Object.freeze([]),
  });
}

export function applyPresentationDecision(state: PresentationSessionState, decision: PresentationDecision): PresentationSessionState {
  const base: PresentationSessionState = Object.freeze({
    ...state,
    pending: Object.freeze(state.pending.filter((request) => request.requestId !== decision.requestId)),
    decisions: Object.freeze([...state.decisions, decision]),
  });
  if (decision.status !== "accepted") return base;
  switch (decision.kind) {
    case "node.add": {
      if (!decision.node) return base;
      const next = applyEnginePresentationEvent(base, { type: "fam.node.changed", node: decision.node });
      const withProjection = decision.projection
        ? applyEnginePresentationEvent(next, { type: "presentation.changed", targetRef: decision.node.nodeId, projection: decision.projection })
        : next;
      return Object.freeze({ ...base, ...withProjection });
    }
    case "node.remove": {
      const connections = base.connections.filter((connection) => !ownsPort(decision.nodeId, connection.fromPortId) && !ownsPort(decision.nodeId, connection.toPortId));
      const { [decision.nodeId]: _removed, ...presentations } = base.presentations;
      return Object.freeze({
        ...base,
        nodes: Object.freeze(refreshPorts(base.nodes.filter((node) => node.nodeId !== decision.nodeId), connections)),
        connections: Object.freeze(connections),
        presentations: Object.freeze(presentations),
        layout: Object.freeze(base.layout.filter((value) => value.nodeId !== decision.nodeId)),
      });
    }
    case "node.move": {
      if (!decision.layout) return base;
      const layout = base.layout.filter((value) => value.nodeId !== decision.layout?.nodeId);
      return Object.freeze({ ...base, layout: Object.freeze([...layout, decision.layout]) });
    }
    case "connection.add": {
      if (!decision.connection || base.connections.some((connection) => connection.connectionId === decision.connection?.connectionId)) return base;
      const connections = [...base.connections, decision.connection];
      return Object.freeze({ ...base, connections: Object.freeze(connections), nodes: Object.freeze(refreshPorts(base.nodes, connections)) });
    }
    case "connection.remove": {
      const connections = base.connections.filter((connection) => connection.connectionId !== decision.connectionId);
      return Object.freeze({ ...base, connections: Object.freeze(connections), nodes: Object.freeze(refreshPorts(base.nodes, connections)) });
    }
    case "property.change": {
      if (!decision.node) return base;
      const next = applyEnginePresentationEvent(base, { type: "fam.node.changed", node: decision.node });
      return Object.freeze({ ...base, nodes: refreshPorts(next.nodes, base.connections) });
    }
    case "presentation.change": {
      if (!decision.projection) return base;
      return Object.freeze({ ...base, ...applyEnginePresentationEvent(base, { type: "presentation.changed", targetRef: decision.targetRef, projection: decision.projection }) });
    }
  }
}

export class PresentationSession {
  readonly registry: PluginPresentationRegistry;
  readonly #port: PresentationDecisionPort;
  readonly #listeners = new Set<PresentationSessionListener>();
  #state: PresentationSessionState;

  constructor(port: PresentationDecisionPort, options: { registry?: PluginPresentationRegistry; initialState?: PresentationSessionState } = {}) {
    this.#port = port;
    this.registry = options.registry ?? new PluginPresentationRegistry();
    this.#state = options.initialState ?? createEmptySessionState();
  }

  get state(): PresentationSessionState {
    return this.#state;
  }

  subscribe(listener: PresentationSessionListener): () => void {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  }

  /** GUI event ABIを受け取る。plugin discovery/removalはregistryへ、それ以外はportへ委譲する。 */
  async dispatch(event: GuiEventAbi): Promise<PresentationSessionState> {
    if (event.type === "plugin.presentation.discovered") {
      this.registry.register(event.registration);
      return this.#state;
    }
    if (event.type === "plugin.presentation.removed") {
      const removedPresentationIds = new Set(
        this.registry.registrations()
          .filter((registration) => registration.pluginId === event.pluginId && registration.capability === event.capability)
          .map((registration) => registration.presentation.presentationId),
      );
      this.registry.unregisterPlugin(event.pluginId);
      let next = this.#state;
      for (const [targetRef, projection] of Object.entries(next.presentations)) {
        if (!projection.presentation || !removedPresentationIds.has(projection.presentation.presentationId)) continue;
        next = Object.freeze({ ...next, ...applyEnginePresentationEvent(next, { type: "plugin.removed", targetRef, reason: "plugin-unavailable" }) });
      }
      return this.#commit(next);
    }
    const pendingState: PresentationSessionState = Object.freeze({ ...this.#state, pending: Object.freeze([...this.#state.pending, event]) });
    this.#commit(pendingState);
    const decision = await this.#port.decide(event, pendingState);
    if (decision.requestId !== event.requestId) {
      throw new Error(`decision-request-mismatch:${event.requestId}:${decision.requestId}`);
    }
    return this.#commit(applyPresentationDecision(this.#state, decision));
  }

  /** engineから届いた確定済みeventを投影する。判定は行わない。 */
  applyEngineEvent(event: EnginePresentationEvent): PresentationSessionState {
    const next = applyEnginePresentationEvent(this.#state, event);
    return this.#commit(Object.freeze({ ...this.#state, ...next, nodes: refreshPorts(next.nodes, this.#state.connections) }));
  }

  #commit(state: PresentationSessionState): PresentationSessionState {
    this.#state = state;
    for (const listener of this.#listeners) listener(state);
    return state;
  }
}

export function pluginEvidenceRef(pluginId: string, capability: string): string {
  return `plugin://${pluginId}/${capability}`;
}

function ownsPort(nodeId: string, portId: string): boolean {
  return portId.startsWith(`${nodeId}:`);
}

/** 確定済みconnectionからport接続状態を再投影する。意味判定ではなく表示同期。 */
function refreshPorts(nodes: readonly NodeViewModel[], connections: readonly ConnectionViewModel[]): readonly NodeViewModel[] {
  const connected = new Set(connections.flatMap((connection) => [connection.fromPortId, connection.toPortId]));
  return nodes.map((node) => {
    const ports: PortViewModel[] = node.ports.map((port) => {
      const status = connected.has(port.portId) ? "connected" : "unconnected";
      return port.connectionStatus === status ? port : Object.freeze({ ...port, connectionStatus: status });
    });
    return ports.every((port, index) => port === node.ports[index]) ? node : Object.freeze({ ...node, ports: Object.freeze(ports) });
  });
}
