import type { ControlStatus, QueryResult } from "@fquery/core";
import type { PluginEditorContract } from "./editor-contract.js";

export type StatusTone = "neutral" | "active" | "success" | "notice" | "warning" | "danger" | "unknown";

export interface StatusBadgeViewModel {
  readonly axis: string;
  readonly value: string;
  readonly tone: StatusTone;
}

export interface PortViewModel {
  readonly portId: string;
  readonly label: string;
  readonly direction: "input" | "output";
  readonly connectionStatus: QueryResult["connectionStatus"];
  readonly cardinality?: "one" | "many";
}

export interface ConnectionViewModel {
  readonly connectionId: string;
  readonly fromPortId: string;
  readonly toPortId: string;
  readonly relationKind?: "dependency" | "causal" | "conditional" | "parent-child";
  readonly relationStatus?: "active" | "cancelled" | "unknown";
  readonly gateRef?: string;
}

export interface LastOrderViewModel {
  readonly code: string;
  readonly reason: string;
  readonly requestedNext: string;
  readonly resumeWhen: string;
}

export interface NodeViewModel {
  readonly nodeId: string;
  readonly label: string;
  readonly badges: readonly StatusBadgeViewModel[];
  readonly ports: readonly PortViewModel[];
  readonly value: unknown;
  readonly evidenceRefs: readonly string[];
  readonly lastOrder?: LastOrderViewModel;
  readonly canExecute: boolean;
  readonly canCancel: boolean;
  readonly foldRef?: string;
  readonly parentFoldRef?: string;
  readonly depth?: number;
  readonly collapsed?: boolean;
  readonly revisionRef?: string;
  readonly projectionFreshness?: "fresh" | "stale" | "unknown";
  /** recursive child graphを一括解決・一括dispatchするFold境界。GUI groupingだけの情報ではない。 */
  readonly foldBoundary?: FoldBoundaryViewModel;
  /** React Flow投影上の親boundary node。canonicalな意味親はparentFoldRefで保持する。 */
  readonly parentNodeId?: string;
  readonly presentation?: PresentationProjection;
}

export interface FoldBoundaryViewModel {
  readonly boundaryRef: string;
  readonly rootFoldRef: string;
  readonly childFoldRefs: readonly string[];
  readonly resolutionMode: "atomic-resolution";
  readonly dispatchMode: "single-processing-unit";
  readonly closesAxes: readonly ("G" | "D" | "L" | "mL")[];
  readonly generation: number;
  readonly status: "running" | "complete" | "failed" | "cancelled";
  readonly boundaryMetrics: FoldBoundaryMetrics;
  readonly width: number;
  readonly height: number;
}

export interface FoldPathStatistics {
  readonly max: number;
  readonly median: number;
  readonly min: number;
}

export interface FoldTechnologyLayerMetrics extends FoldPathStatistics {
  readonly continuity: "connected" | "disconnected" | "not-declared";
  readonly broken_route_refs: readonly string[];
}

export interface FoldBoundaryContinuation {
  readonly mode: "spiritual-trust" | "imaginative-hypothesis";
  readonly domain_ref: string;
  readonly claimant_ref: string;
  readonly claim_status: "declared-belief" | "hypothesis";
  readonly verification_status: "not-verified" | "verification-not-applicable" | "verification-prohibited";
  readonly verification_boundary_ref: string | null;
  readonly source_tool_chain_continuity: FoldTechnologyLayerMetrics["continuity"];
  readonly relabels_tool_chain_as_connected: false;
}

/** FoldをRunnerへ渡すG/D/L/mL/S。値は宣言済みgraphからだけ計算する。 */
export interface FoldBoundaryMetrics {
  /** Gravity: boundaryを跨いだFold-on-Fold path深度の標準3統計。 */
  readonly G: FoldPathStatistics;
  /** Dimension: Fold内で明示された一意なcontext dimension数。 */
  readonly D: number;
  /** Layer: API、adapter、tool等のtechnology chain node数の標準3統計。 */
  readonly L: FoldTechnologyLayerMetrics;
  /** meta Layer: 判断・解釈を含むcontext chain。MLと区別するため小文字mを保持する。 */
  readonly mL: FoldPathStatistics;
  /** Dへ混ぜないpresentation構造補助量。 */
  readonly direct_child_count: number;
  /** Socket/SDK: 元tool経路の外部接続契約。不在時の既定はLast Order。 */
  readonly S: {
    readonly socket_present: boolean;
    readonly adapter_ref: string | null;
    readonly on_missing: "last-order";
  };
}

export type PresentationSurface =
  | "node-editor"
  | "node-palette"
  | "add-node-search"
  | "context-menu"
  | "inspector"
  | "sidebar"
  | "toolbar"
  | "overlay"
  | "preview"
  | "command-palette";

/**
 * Renderer非依存の描画意味。pixel座標、size、zoom等の実値は含めず、
 * layoutSlotRefが指すHost側のIBD／KV adapterへ委譲する。
 */
export interface PresentationFam {
  readonly schemaVersion: "fquery.presentation-fam/0.1.0-draft";
  readonly presentationId: string;
  readonly targetRef: string;
  readonly surfaces: readonly PresentationSurface[];
  readonly visualRole: string;
  readonly interfaceRoles: readonly string[];
  readonly visibility: "visible" | "collapsed" | "hidden";
  readonly rendererHint?: string;
  readonly category?: string;
  readonly aliases?: readonly string[];
  readonly grouping?: string;
  readonly layoutSlotRef?: string;
}

export interface PluginPresentationRegistration {
  readonly pluginId: string;
  readonly pluginVersion: string;
  readonly capability: string;
  readonly presentation: PresentationFam;
  /** 任意。Node Panelが編集できるQ schema／subtreeの宣言（Issue #27）。未宣言でもregistrationは有効。 */
  readonly editor?: PluginEditorContract;
}

export interface RendererCapability {
  readonly rendererId: string;
  readonly supportedHints: readonly string[];
}

export interface PresentationProjection {
  readonly targetRef: string;
  readonly mode: "native" | "generic" | "ghost";
  readonly rendererId: string;
  readonly presentation?: PresentationFam;
  readonly reason?: "renderer-unsupported" | "plugin-unavailable" | "plugin-selection-unresolved";
}

export interface PresentationRequest {
  readonly targetRef: string;
  readonly capability: string;
  readonly pluginId?: string;
  readonly renderer: RendererCapability;
}

export class PluginPresentationRegistry {
  readonly #byRegistration = new Map<string, PluginPresentationRegistration>();

  register(registration: PluginPresentationRegistration): void {
    validatePresentationRegistration(registration);
    const key = registrationKey(registration.pluginId, registration.capability);
    if (this.#byRegistration.has(key)) throw new Error(`presentation-already-registered:${registration.pluginId}:${registration.capability}`);
    this.#byRegistration.set(key, freezeRegistration(registration));
  }

  unregisterPlugin(pluginId: string): readonly string[] {
    const removed: string[] = [];
    for (const [key, registration] of this.#byRegistration) {
      if (registration.pluginId !== pluginId) continue;
      this.#byRegistration.delete(key);
      removed.push(registration.capability);
    }
    return Object.freeze(removed);
  }

  registrations(): readonly PluginPresentationRegistration[] {
    return Object.freeze([...this.#byRegistration.values()]);
  }

  project(request: PresentationRequest): PresentationProjection {
    const candidates = [...this.#byRegistration.values()].filter((registration) =>
      registration.capability === request.capability && (!request.pluginId || registration.pluginId === request.pluginId),
    );
    const registration = candidates.length === 1 ? candidates[0] : undefined;
    if (!registration) {
      return Object.freeze({
        targetRef: request.targetRef,
        mode: "ghost",
        rendererId: request.renderer.rendererId,
        reason: candidates.length > 1 ? "plugin-selection-unresolved" : "plugin-unavailable",
      });
    }
    const hint = registration.presentation.rendererHint;
    if (hint && !request.renderer.supportedHints.includes(hint)) {
      return Object.freeze({
        targetRef: request.targetRef,
        mode: "generic",
        rendererId: request.renderer.rendererId,
        presentation: registration.presentation,
        reason: "renderer-unsupported",
      });
    }
    return Object.freeze({
      targetRef: request.targetRef,
      mode: "native",
      rendererId: request.renderer.rendererId,
      presentation: registration.presentation,
    });
  }
}

export type GuiEventAbi =
  | { readonly type: "node.add.requested"; readonly requestId: string; readonly capability: string; readonly presentationRef?: string }
  | { readonly type: "node.remove.requested"; readonly requestId: string; readonly nodeId: string }
  | { readonly type: "node.move.requested"; readonly requestId: string; readonly nodeId: string; readonly layoutSlotRef: string; readonly x: number; readonly y: number }
  | { readonly type: "connection.add.requested"; readonly requestId: string; readonly fromPortId: string; readonly toPortId: string; readonly relationKind?: ConnectionViewModel["relationKind"]; readonly relationStatus?: ConnectionViewModel["relationStatus"]; readonly gateRef?: string }
  | { readonly type: "connection.remove.requested"; readonly requestId: string; readonly connectionId: string }
  | { readonly type: "property.change.requested"; readonly requestId: string; readonly targetRef: string; readonly property: string; readonly value: unknown }
  | { readonly type: "presentation.change.requested"; readonly requestId: string; readonly targetRef: string; readonly presentationRef: string }
  | { readonly type: "node.select.requested"; readonly requestId: string; readonly nodeIds: readonly string[]; readonly activeNodeId?: string }
  | { readonly type: "plugin.presentation.discovered"; readonly registration: PluginPresentationRegistration }
  | { readonly type: "plugin.presentation.removed"; readonly pluginId: string; readonly capability: string };

export interface ConnectionDecision {
  readonly requestId: string;
  readonly status: "accepted" | "rejected" | "unresolved";
  readonly reason?: string;
  readonly evidenceRefs: readonly string[];
}

export type EnginePresentationEvent =
  | { readonly type: "fam.node.changed"; readonly node: NodeViewModel }
  | { readonly type: "source.changed" | "source.diverged" | "q.changed" | "abi.mismatch"; readonly targetRef: string; readonly state: unknown }
  | { readonly type: "presentation.changed"; readonly targetRef: string; readonly projection: PresentationProjection }
  | { readonly type: "plugin.added"; readonly targetRef: string; readonly state: unknown }
  | { readonly type: "plugin.removed" | "implementation.unavailable"; readonly targetRef: string; readonly reason?: string };

export interface PresentationProjectionState {
  readonly nodes: readonly NodeViewModel[];
  readonly presentations: Readonly<Record<string, PresentationProjection>>;
  readonly engineStates: Readonly<Record<string, unknown>>;
}

/** Engineが計算済みのeventだけをnode/ref単位で投影する。意味計算は行わない。 */
export function applyEnginePresentationEvent(
  state: PresentationProjectionState,
  event: EnginePresentationEvent,
): PresentationProjectionState {
  if (event.type === "fam.node.changed") {
    const index = state.nodes.findIndex((node) => node.nodeId === event.node.nodeId);
    const nodes = index < 0
      ? [...state.nodes, event.node]
      : state.nodes.map((node, nodeIndex) => nodeIndex === index ? event.node : node);
    return Object.freeze({ ...state, nodes: Object.freeze(nodes) });
  }
  if (event.type === "presentation.changed") {
    return Object.freeze({
      ...state,
      presentations: Object.freeze({ ...state.presentations, [event.targetRef]: event.projection }),
    });
  }
  if (event.type === "plugin.removed" || event.type === "implementation.unavailable") {
    const current = state.presentations[event.targetRef];
    const ghost: PresentationProjection = Object.freeze({
      targetRef: event.targetRef,
      mode: "ghost",
      rendererId: current?.rendererId ?? "generic",
      ...(current?.presentation ? { presentation: current.presentation } : {}),
      reason: "plugin-unavailable",
    });
    return Object.freeze({
      ...state,
      presentations: Object.freeze({ ...state.presentations, [event.targetRef]: ghost }),
    });
  }
  return Object.freeze({
    ...state,
    engineStates: Object.freeze({
      ...state.engineStates,
      [event.targetRef]: "state" in event ? event.state : undefined,
    }),
  });
}

export type FQueryUiEvent =
  | { readonly type: "connect"; readonly fromPortId: string; readonly toPortId: string }
  | { readonly type: "disconnect"; readonly portId: string }
  | { readonly type: "inspect"; readonly nodeId: string }
  | { readonly type: "focus"; readonly nodeId: string }
  | { readonly type: "jump"; readonly nodeId: string; readonly pointer: string }
  | { readonly type: "preview"; readonly nodeId: string }
  | { readonly type: "execute-request"; readonly nodeId: string }
  | { readonly type: "cancel-request"; readonly nodeId: string }
  | GuiEventAbi;

export type FQueryHostKind = "vscode" | "sphere" | "browser" | "electron";

export interface FQueryHostOutboundMessage {
  readonly protocol: "fquery-host/0.1.0-draft";
  readonly source: FQueryHostKind;
  readonly type: "ui-event";
  readonly event: FQueryUiEvent;
}

export interface FQueryHostInboundMessage {
  readonly protocol: "fquery-host/0.1.0-draft";
  readonly type: "state";
  readonly nodes: readonly NodeViewModel[];
}

export type FQueryHostStateListener = (nodes: readonly NodeViewModel[]) => void;

export function createHostOutboundMessage(source: FQueryHostKind, event: FQueryUiEvent): FQueryHostOutboundMessage {
  return Object.freeze({ protocol: "fquery-host/0.1.0-draft", source, type: "ui-event", event });
}

export function parseHostInboundMessage(message: unknown): FQueryHostInboundMessage | undefined {
  if (!isRecord(message)) return undefined;
  if (message.protocol !== "fquery-host/0.1.0-draft" || message.type !== "state" || !Array.isArray(message.nodes)) return undefined;
  if (!message.nodes.every(isNodeViewModel)) return undefined;
  return message as unknown as FQueryHostInboundMessage;
}

export function createNodeViewModel(result: QueryResult, label = result.queryRef): NodeViewModel {
  const badges = [
    badge("resolution", result.resolutionStatus),
    badge("connection", result.connectionStatus),
    badge("transport", result.transportStatus),
    badge("plugin", result.pluginStatus),
    badge("semantic", result.semanticStatus),
    badge("lambda", result.lambdaStatus),
    badge("control", result.controlStatus),
  ];
  return Object.freeze({
    nodeId: result.queryRef,
    label,
    badges: Object.freeze(badges),
    ports: Object.freeze([
      { portId: `${result.queryRef}:input`, label: "input", direction: "input" as const, connectionStatus: "connected" as const },
      { portId: `${result.queryRef}:output`, label: "output", direction: "output" as const, connectionStatus: result.connectionStatus },
    ]),
    value: result.value,
    evidenceRefs: Object.freeze([...result.evidenceRefs]),
    ...(result.lastOrder ? { lastOrder: Object.freeze({ ...result.lastOrder }) } : {}),
    canExecute: canExecute(result.controlStatus),
    canCancel: result.controlStatus === "continue",
  });
}

export function statusTone(value: string): StatusTone {
  if (["satisfied", "succeeded", "resolved", "connected", "result", "valid-variation"].includes(value)) return "success";
  if (["running", "continue"].includes(value)) return "active";
  if (["unconnected", "not-started", "not-requested", "not-evaluated", "not-applicable"].includes(value)) return "notice";
  if (["unknown", "unresolved"].includes(value)) return "unknown";
  if (["semantic-unsatisfied", "unsatisfied", "last-order", "plugin-not-found"].includes(value)) return "warning";
  if (["bottom", "failed", "rejected", "cancelled"].includes(value)) return "danger";
  return "neutral";
}

function badge(axis: string, value: string): StatusBadgeViewModel {
  return Object.freeze({ axis, value, tone: statusTone(value) });
}

function canExecute(status: ControlStatus): boolean {
  return status === "result" || status === "last-order" || status === "bottom" || status === "cancelled";
}

function isNodeViewModel(value: unknown): value is NodeViewModel {
  if (!isRecord(value)) return false;
  return (
    typeof value.nodeId === "string" &&
    typeof value.label === "string" &&
    Array.isArray(value.badges) &&
    Array.isArray(value.ports) &&
    Array.isArray(value.evidenceRefs) &&
    typeof value.canExecute === "boolean" &&
    typeof value.canCancel === "boolean"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validatePresentationRegistration(registration: PluginPresentationRegistration): void {
  if (!registration.pluginId || !registration.capability) throw new TypeError("pluginIdとcapabilityは必須です");
  const presentation = registration.presentation;
  if (presentation.schemaVersion !== "fquery.presentation-fam/0.1.0-draft") throw new TypeError("unsupported Presentation FAM schemaVersion");
  if (!presentation.presentationId || !presentation.targetRef) throw new TypeError("Presentation FAMの識別子は必須です");
  if (presentation.surfaces.length === 0) throw new TypeError("Presentation FAMにはsurfaceが必要です");
  if ("x" in presentation || "y" in presentation || "width" in presentation || "height" in presentation || "zoom" in presentation) {
    throw new TypeError("layout実値はPresentation FAMへ保存できません");
  }
}

function freezeRegistration(registration: PluginPresentationRegistration): PluginPresentationRegistration {
  return Object.freeze({
    ...registration,
    presentation: Object.freeze({
      ...registration.presentation,
      surfaces: Object.freeze([...registration.presentation.surfaces]),
      interfaceRoles: Object.freeze([...registration.presentation.interfaceRoles]),
      ...(registration.presentation.aliases ? { aliases: Object.freeze([...registration.presentation.aliases]) } : {}),
    }),
  });
}

function registrationKey(pluginId: string, capability: string): string {
  return `${pluginId}\u0000${capability}`;
}

export {
  PresentationSession,
  applyPresentationDecision,
  createEmptySessionState,
  pluginEvidenceRef,
  type DecisionStatus,
  type GuiRequest,
  type LayoutValue,
  type NodeSelection,
  normalizeSelection,
  selectionEquals,
  type PresentationDecision,
  type PresentationDecisionPort,
  type PresentationSessionListener,
  type PresentationSessionState,
} from "./session.js";
export { createFixtureDecisionPort, type FixtureDecisionPortOptions } from "./fixture-port.js";
export {
  CORE_NODE_CONTRACTS,
  CORE_PLUGIN_ID,
  CORE_PLUGIN_VERSION,
  CORE_RENDERER_HINT,
  coreNodeRegistrations,
  corePortId,
  createCoreNodeViewModel,
  findCoreNodeContract,
  registerCoreNodes,
  type CoreNodeContract,
  type CoreNodePort,
  type CoreNodeType,
  type CoreNodeViewModelOptions,
  type FamRole,
} from "./core-nodes.js";
export {
  Q_SCHEMA_VERSION,
  deriveKnownPointers,
  escapePointerToken,
  findRegistrationByPresentation,
  type PluginEditorContract,
  type QSchema,
  type QSchemaProperty,
} from "./editor-contract.js";
export {
  PaneRegistry,
  createPaneContext,
  type PaneContext,
  type PaneContribution,
  type PaneSectionSpec,
  type PaneSide,
  type PaneTabSpec,
  type PluginPaneContribution,
  type ResolvedPaneSection,
  type ResolvedPaneTab,
} from "./pane-contract.js";
export { declareFoldBoundaryContinuation, deriveFoldBoundaryMetrics, foldBoundaryLastOrder, type FoldBoundaryContinuationInput, type FoldBoundaryMetricsInput, type ProceduralChildEdge, type RequiredTechnologyRoute } from "./fold-boundary.js";
