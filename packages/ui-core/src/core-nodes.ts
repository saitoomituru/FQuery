import type {
  NodeViewModel,
  PluginPresentationRegistration,
  PluginPresentationRegistry,
  PortViewModel,
  PresentationFam,
  PresentationSurface,
  StatusBadgeViewModel,
} from "./index.js";

/**
 * FAMの意味役割。GUI node typeはこの役割へ参加するだけで、ontology正本ではない。
 * `Q`はnodeごとの設定・制約・source・observer・registry・presentation拡張として
 * canonical FAM側に保持され、NodeViewModelへは複製しない。
 */
export type FamRole = "ψ" | "∇φ" | "λ";

export type CoreNodeType = "Ψ.NL" | "∇φ.FAMVIM" | "λ.NL";

export interface CoreNodePort {
  readonly portKey: string;
  readonly label: string;
  readonly direction: "input" | "output";
  /** portが運ぶ意味役割。接続可否の判定はengineへ委譲し、GUIはこの値で判断しない。 */
  readonly carries: FamRole | "observation" | "manifestation";
  readonly cardinality?: "one" | "many";
}

export interface CoreNodeContract {
  readonly nodeType: CoreNodeType;
  readonly famRole: FamRole;
  readonly capability: string;
  readonly ports: readonly CoreNodePort[];
  readonly presentation: PresentationFam;
}

export const CORE_PLUGIN_ID = "fquery.core";
export const CORE_PLUGIN_VERSION = "0.1.0-draft";
export const CORE_RENDERER_HINT = "fquery-core-node";

function presentation(nodeType: CoreNodeType, capability: string, visualRole: string, interfaceRoles: readonly string[], aliases: readonly string[]): PresentationFam {
  return Object.freeze({
    schemaVersion: "fquery.presentation-fam/0.1.0-draft",
    presentationId: `presentation://fquery/core/${capability}`,
    targetRef: `capability://${capability}`,
    surfaces: Object.freeze<PresentationSurface[]>(["node-editor", "node-palette", "add-node-search", "inspector"]),
    visualRole,
    interfaceRoles: Object.freeze([...interfaceRoles]),
    visibility: "visible",
    rendererHint: CORE_RENDERER_HINT,
    category: "Core",
    aliases: Object.freeze([nodeType, ...aliases]),
  });
}

export const CORE_NODE_CONTRACTS: readonly CoreNodeContract[] = Object.freeze([
  Object.freeze({
    nodeType: "Ψ.NL",
    famRole: "ψ",
    capability: "core.psi.nl-input",
    ports: Object.freeze([
      Object.freeze({ portKey: "observation", label: "observation", direction: "output", carries: "observation" }),
    ] as const),
    presentation: presentation("Ψ.NL", "core.psi.nl-input", "psi-input", ["observation"], ["natural language", "input", "ψ"]),
  }),
  Object.freeze({
    nodeType: "∇φ.FAMVIM",
    famRole: "∇φ",
    capability: "core.gradient.famvim",
    ports: Object.freeze([
      Object.freeze({ portKey: "psi", label: "ψ", direction: "input", carries: "observation" }),
      Object.freeze({ portKey: "fam", label: "FAM", direction: "output", carries: "∇φ" }),
    ] as const),
    presentation: presentation("∇φ.FAMVIM", "core.gradient.famvim", "fam-editor", ["psi", "fam"], ["FAMVIM", "RAW FAM", "editor", "∇φ"]),
  }),
  Object.freeze({
    nodeType: "λ.NL",
    famRole: "λ",
    capability: "core.lambda.nl-output",
    ports: Object.freeze([
      Object.freeze({ portKey: "fam", label: "FAM", direction: "input", carries: "∇φ", cardinality: "many" }),
      Object.freeze({ portKey: "manifestation", label: "manifestation", direction: "output", carries: "manifestation" }),
    ] as const),
    presentation: presentation("λ.NL", "core.lambda.nl-output", "lambda-output", ["fam", "manifestation"], ["natural language", "output", "λ"]),
  }),
]);

export function findCoreNodeContract(capabilityOrType: string): CoreNodeContract | undefined {
  return CORE_NODE_CONTRACTS.find((contract) => contract.capability === capabilityOrType || contract.nodeType === capabilityOrType);
}

export function coreNodeRegistrations(): readonly PluginPresentationRegistration[] {
  return Object.freeze(CORE_NODE_CONTRACTS.map((contract) => Object.freeze({
    pluginId: CORE_PLUGIN_ID,
    pluginVersion: CORE_PLUGIN_VERSION,
    capability: contract.capability,
    presentation: contract.presentation,
    editor: Object.freeze({ famRole: contract.famRole }),
  })));
}

export function registerCoreNodes(registry: PluginPresentationRegistry): void {
  for (const registration of coreNodeRegistrations()) registry.register(registration);
}

export interface CoreNodeViewModelOptions {
  readonly label?: string;
  readonly value?: unknown;
  readonly badges?: readonly StatusBadgeViewModel[];
  readonly evidenceRefs?: readonly string[];
  readonly canExecute?: boolean;
}

export function corePortId(nodeId: string, portKey: string): string {
  return `${nodeId}:${portKey}`;
}

/** contractからNodeViewModelを投影する。valueはcanonical FAMへの参照または表示用複製であり正本ではない。 */
export function createCoreNodeViewModel(contract: CoreNodeContract, nodeId: string, options: CoreNodeViewModelOptions = {}): NodeViewModel {
  const ports: readonly PortViewModel[] = Object.freeze(contract.ports.map((port) => Object.freeze({
    portId: corePortId(nodeId, port.portKey),
    label: port.label,
    direction: port.direction,
    connectionStatus: "unconnected" as const,
    cardinality: port.cardinality ?? "one",
  })));
  return Object.freeze({
    nodeId,
    label: options.label ?? contract.nodeType,
    badges: Object.freeze([...(options.badges ?? [])]),
    ports,
    value: options.value ?? null,
    evidenceRefs: Object.freeze([...(options.evidenceRefs ?? [])]),
    canExecute: options.canExecute ?? false,
    canCancel: false,
  });
}
