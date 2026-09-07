import type { NodeViewModel, PluginPresentationRegistry, RendererCapability } from "./index.js";
import { pluginEvidenceRef, type GuiRequest, type PresentationDecision, type PresentationDecisionPort, type PresentationSessionState } from "./session.js";

export interface FixtureDecisionPortOptions {
  readonly registry: PluginPresentationRegistry;
  readonly renderer: RendererCapability;
  /** capabilityからNodeViewModelを生成する。semantic engineではなくfixture投影。 */
  readonly createNode: (capability: string, nodeId: string, request: GuiRequest & { type: "node.add.requested" }) => NodeViewModel;
  readonly nodeIdPrefix?: string;
  /**
   * property.change.requestedをHost側で解決するhook。置換nodeを返せばaccepted、
   * undefinedならunresolved。fixture portはvalue以外のpropertyを自分で判断しない。
   */
  readonly resolveProperty?: (node: NodeViewModel, property: string, value: unknown) => NodeViewModel | { readonly rejected: string } | undefined;
}

/**
 * 外部engineが無い環境（Playground、component test）向けの決定port。
 * 構造的に判断できること（port方向、node存在、plugin一意性）だけを判定し、
 * semantic／λ／Q判定は行わず`unresolved`のまま返す。
 */
export function createFixtureDecisionPort(options: FixtureDecisionPortOptions): PresentationDecisionPort {
  let sequence = 0;
  const prefix = options.nodeIdPrefix ?? "q://fixture/session";
  return {
    decide(request: GuiRequest, state: PresentationSessionState): PresentationDecision {
      switch (request.type) {
        case "node.add.requested": {
          const candidates = options.registry.registrations().filter((registration) => registration.capability === request.capability
            && (!request.presentationRef || registration.presentation.presentationId === request.presentationRef));
          if (candidates.length !== 1) {
            return decision({ kind: "node.add", requestId: request.requestId, status: "unresolved", reason: candidates.length > 1 ? "plugin-selection-unresolved" : "plugin-unavailable" });
          }
          const registration = candidates[0]!;
          sequence += 1;
          const nodeId = `${prefix}/${sequence}`;
          const node = options.createNode(request.capability, nodeId, request);
          const projection = options.registry.project({ targetRef: nodeId, capability: request.capability, pluginId: registration.pluginId, renderer: options.renderer });
          return decision({
            kind: "node.add",
            requestId: request.requestId,
            status: "accepted",
            node,
            projection: projection.presentation
              ? { ...projection, presentation: { ...projection.presentation, targetRef: nodeId, layoutSlotRef: `layout://fixture/${sequence}` } }
              : projection,
            evidenceRefs: [pluginEvidenceRef(registration.pluginId, registration.capability)],
          });
        }
        case "node.remove.requested":
          return state.nodes.some((node) => node.nodeId === request.nodeId)
            ? decision({ kind: "node.remove", requestId: request.requestId, status: "accepted", nodeId: request.nodeId })
            : decision({ kind: "node.remove", requestId: request.requestId, status: "rejected", nodeId: request.nodeId, reason: "node-not-found" });
        case "node.move.requested":
          return decision({ kind: "node.move", requestId: request.requestId, status: "accepted", nodeId: request.nodeId, layout: { nodeId: request.nodeId, x: request.x, y: request.y } });
        case "connection.add.requested": {
          const from = findPort(state, request.fromPortId);
          const to = findPort(state, request.toPortId);
          if (!from || !to) return decision({ kind: "connection.add", requestId: request.requestId, status: "rejected", reason: "port-not-found" });
          if (from.direction !== "output" || to.direction !== "input") return decision({ kind: "connection.add", requestId: request.requestId, status: "rejected", reason: "port-direction-mismatch" });
          if (from.nodeId === to.nodeId) return decision({ kind: "connection.add", requestId: request.requestId, status: "rejected", reason: "self-connection" });
          if (state.connections.some((connection) => connection.toPortId === request.toPortId)) return decision({ kind: "connection.add", requestId: request.requestId, status: "rejected", reason: "input-already-connected" });
          return decision({
            kind: "connection.add",
            requestId: request.requestId,
            status: "accepted",
            connection: { connectionId: `connection://fixture/${request.fromPortId}->${request.toPortId}`, fromPortId: request.fromPortId, toPortId: request.toPortId },
          });
        }
        case "connection.remove.requested":
          return state.connections.some((connection) => connection.connectionId === request.connectionId)
            ? decision({ kind: "connection.remove", requestId: request.requestId, status: "accepted", connectionId: request.connectionId })
            : decision({ kind: "connection.remove", requestId: request.requestId, status: "rejected", connectionId: request.connectionId, reason: "connection-not-found" });
        case "property.change.requested": {
          const node = state.nodes.find((candidate) => candidate.nodeId === request.targetRef);
          if (!node) return decision({ kind: "property.change", requestId: request.requestId, status: "rejected", targetRef: request.targetRef, reason: "node-not-found" });
          if (request.property === "value") return decision({ kind: "property.change", requestId: request.requestId, status: "accepted", targetRef: request.targetRef, node: Object.freeze({ ...node, value: request.value }) });
          const resolved = options.resolveProperty?.(node, request.property, request.value);
          if (!resolved) return decision({ kind: "property.change", requestId: request.requestId, status: "unresolved", targetRef: request.targetRef, reason: "fixture-port-no-semantic-engine" });
          if ("rejected" in resolved) return decision({ kind: "property.change", requestId: request.requestId, status: "rejected", targetRef: request.targetRef, reason: resolved.rejected });
          return decision({ kind: "property.change", requestId: request.requestId, status: "accepted", targetRef: request.targetRef, node: resolved });
        }
        case "presentation.change.requested":
          return decision({ kind: "presentation.change", requestId: request.requestId, status: "unresolved", targetRef: request.targetRef, reason: "fixture-port-no-presentation-store" });
      }
    },
  };
}

function findPort(state: PresentationSessionState, portId: string): { nodeId: string; direction: "input" | "output" } | undefined {
  for (const node of state.nodes) {
    const port = node.ports.find((candidate) => candidate.portId === portId);
    if (port) return { nodeId: node.nodeId, direction: port.direction };
  }
  return undefined;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type DecisionInput = DistributiveOmit<PresentationDecision, "evidenceRefs"> & { readonly evidenceRefs?: readonly string[] };

function decision(input: DecisionInput): PresentationDecision {
  return Object.freeze({ ...input, evidenceRefs: Object.freeze([...(input.evidenceRefs ?? [])]) }) as PresentationDecision;
}
