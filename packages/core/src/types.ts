export type ResolutionStatus = "unresolved" | "resolved" | "bottom" | "unknown";
export type ConnectionStatus = "unconnected" | "connected" | "not-applicable";
export type TransportStatus = "not-started" | "running" | "succeeded" | "failed" | "unknown";
export type PluginStatus = "not-requested" | "resolved" | "plugin-not-found" | "rejected" | "unknown";
export type SemanticStatus = "not-evaluated" | "satisfied" | "semantic-unsatisfied" | "unknown";
export type LambdaStatus = "not-evaluated" | "satisfied" | "unsatisfied" | "unknown";
export type ControlStatus = "continue" | "result" | "bottom" | "last-order" | "cancelled";

export interface StatusAxes {
  resolutionStatus: ResolutionStatus;
  connectionStatus: ConnectionStatus;
  transportStatus: TransportStatus;
  pluginStatus: PluginStatus;
  semanticStatus: SemanticStatus;
  lambdaStatus: LambdaStatus;
  controlStatus: ControlStatus;
}

export type QueryInput =
  | { readonly kind: "literal"; readonly value: unknown }
  | { readonly kind: "binding"; readonly name: string }
  | { readonly kind: "query-ref"; readonly queryRef: string };

export type QueryOperation =
  | { readonly kind: "select"; readonly path: readonly (string | number)[] }
  | { readonly kind: "bind"; readonly name: string }
  | { readonly kind: "project"; readonly fields: readonly string[] }
  | { readonly kind: "invoke"; readonly capability: string }
  | { readonly kind: "validate"; readonly verifierRef: string };

export interface QueryGoal {
  readonly lambdaRef: string;
  readonly verifierRef?: string;
}

export interface QueryLimits {
  readonly maxDepth: number;
  readonly maxNodes: number;
  readonly timeoutMs: number;
}

export interface QueryPolicy {
  readonly sideEffect: "deny" | "none" | "read" | "write" | "network" | "physical";
  readonly unknown: "retain";
  readonly unresolved: "retain";
  readonly limits: QueryLimits;
}

export interface QueryNode {
  readonly schemaVersion: "fquery/0.1.0-draft";
  readonly queryId: string;
  readonly operator: "Q";
  readonly input: QueryInput;
  readonly operations: readonly QueryOperation[];
  readonly goal?: QueryGoal;
  readonly policy: QueryPolicy;
}

export interface LastOrder {
  readonly code: string;
  readonly reason: string;
  readonly requestedNext: string;
  readonly resumeWhen: string;
}

export interface QueryResult extends StatusAxes {
  readonly queryRef: string;
  readonly value?: unknown;
  readonly reason?: string;
  readonly evidenceRefs: readonly string[];
  readonly variationStatus?: "valid-variation";
  readonly lastOrder?: LastOrder;
}

export interface CapabilityInvocation {
  readonly queryRef: string;
  readonly capability: string;
  readonly input: unknown;
  readonly sideEffect: QueryPolicy["sideEffect"];
}

export interface CapabilityResult {
  readonly pluginId: string;
  readonly pluginStatus?: "resolved" | "rejected";
  readonly value?: unknown;
  readonly transportStatus: "succeeded" | "failed" | "unknown";
  readonly evidenceRefs?: readonly string[];
  readonly reason?: string;
  readonly execution?: {
    readonly provider: string;
    readonly model: string;
    readonly credentialName?: string;
    readonly requestId?: string;
  };
}

export interface PluginResolver {
  invoke(request: CapabilityInvocation): Promise<CapabilityResult | undefined>;
}

export interface VerificationResult {
  readonly satisfied: boolean;
  readonly evidenceRefs: readonly string[];
  readonly validVariation?: boolean;
}

export type Verifier = (value: unknown, lambdaRef: string) => VerificationResult | Promise<VerificationResult>;

export interface CoreEvent {
  readonly eventType:
    | "query-received"
    | "bind"
    | "plugin-resolve"
    | "plugin-call-start"
    | "plugin-call-end"
    | "projection"
    | "semantic-check"
    | "bottom"
    | "unknown"
    | "last-order"
    | "result";
  readonly queryRef: string;
  readonly status: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

export interface EvaluationContext {
  readonly bindings?: Readonly<Record<string, unknown>>;
  readonly queryResolver?: (queryRef: string) => QueryNode | undefined | Promise<QueryNode | undefined>;
  readonly pluginResolver?: PluginResolver;
  readonly verifiers?: Readonly<Record<string, Verifier>>;
  readonly outputConnected?: boolean;
  readonly emit?: (event: CoreEvent) => void;
  readonly now?: () => number;
}
