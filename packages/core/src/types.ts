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
  /** baseは読めるがservice profile未適合の場合に、手直し用candidateを失わない。 */
  readonly candidate?: unknown;
  readonly profileValidation?: CapabilityProfileValidation;
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
  /** Hostが実行前に解決したrevision固定profile。Coreはprofile固有の意味を解釈しない。 */
  readonly profileBindings?: readonly CapabilityProfileBinding[];
  /** Q deadlineに連動するclient側cancel。provider側課金停止を保証しない。 */
  readonly signal?: AbortSignal;
}

export interface CapabilityProfileBinding {
  readonly profileRef: string;
  readonly revisionRef: string;
  readonly mediaType: string;
  readonly roles: readonly ("generation-constraint" | "validation-ruler" | "presentation-ruler")[];
  /** providerへ渡せるlossless profile projection。 */
  readonly value: unknown;
}

export interface CapabilityProfileReceipt {
  readonly profileRef: string;
  readonly revisionRef: string;
  readonly appliedStages: readonly ("generation-constraint" | "post-validation" | "presentation-projection")[];
  /** post-validationが何を実測したか。context/hash一致を暗黙に含めない。 */
  readonly validationScope?: string;
  /**
   * 外部rule/evaluatorが返したOAE拘束評価。FQueryはdomain固有の成立条件や
   * 複数observerのverdict優先順位を解釈せず、参照束縛と確定可能性だけを保持する。
   */
  readonly oaeConstraintEvaluations?: readonly OaeConstraintEvaluationReceipt[];
}

export interface OaeConstraintEvaluationReceipt {
  readonly subjectRef: string;
  readonly subjectRevisionRef: string;
  readonly observerRef: string;
  readonly observerDomainRef: string;
  readonly ruleRef: string;
  readonly ruleRevisionRef: string;
  readonly candidateRecordRef: string;
  readonly candidateRecordRevisionRef: string;
  readonly evaluatorRef: string;
  readonly evaluatorRevisionRef: string;
  readonly recordIntegrity: "valid" | "invalid";
  readonly ruleConformance: "satisfied" | "not-satisfied" | "not-evaluable";
  /** domain rule側の語彙。Coreはmatched/completed/experienced等を列挙・裁定しない。 */
  readonly observerVerdict: string;
  readonly evidenceRefs: readonly string[];
  readonly issueCodes: readonly string[];
}

export type FamAdapterSupportLevel = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * adapter自身の申告。Coreは実質充足を認証・降格せず、そのまま記録する。
 */
export interface FamAdapterSupportClaim {
  readonly schemaVersion: "fam.adapter-support/0.1.0-draft";
  readonly level: FamAdapterSupportLevel;
  readonly capabilityRefs: readonly string[];
  readonly observationSurfaces: readonly string[];
  readonly limitations: readonly string[];
  readonly [extension: string]: unknown;
}

export interface AdapterChainHop {
  readonly adapterRef: string;
  readonly adapterRevision: string;
  readonly providerRef?: string;
  readonly modelRef?: string;
  readonly runtimeRef?: string;
  readonly harnessRef?: string;
  readonly [extension: string]: unknown;
}

/** FAM候補を誰がどの経路で生成したかを保存するtransport receipt。 */
export interface AdapterProvenanceReceipt {
  readonly schemaVersion: "fam.adapter-provenance/0.1.0-draft";
  readonly producerRef: string;
  readonly producerRevision: string;
  readonly adapterChain: readonly AdapterChainHop[];
  readonly supportClaim?: FamAdapterSupportClaim;
  readonly oaeRefs: readonly string[];
  readonly [extension: string]: unknown;
}

export interface CapabilityResult {
  readonly pluginId: string;
  readonly pluginStatus?: "resolved" | "rejected";
  readonly value?: unknown;
  readonly transportStatus: "succeeded" | "failed" | "unknown";
  /** provider応答をcanonical出力として採用できたか。transport状態と混同しない。 */
  readonly outputStatus?: "accepted" | "profile-nonconformant" | "invalid";
  /** canonical valueとして採用できない場合のlosslessな手直し対象。 */
  readonly candidate?: unknown;
  readonly profileValidation?: CapabilityProfileValidation;
  readonly evidenceRefs?: readonly string[];
  readonly adapterProvenance?: AdapterProvenanceReceipt;
  readonly reason?: string;
  /** 実際に適用した段階だけを記録する。意図されたrolesの宣言とは分離する。 */
  readonly profileReceipts?: readonly CapabilityProfileReceipt[];
  /** source内容を生成せず、consumer profile所有の不変条件だけを補正したreceipt。 */
  readonly normalization?: {
    readonly profileRef: string;
    readonly repairedPaths: readonly string[];
  };
  readonly execution?: {
    readonly provider: string;
    readonly model: string;
    readonly pluginVersion?: string;
    readonly credentialName?: string;
    readonly requestId?: string;
  };
}

export interface CapabilityProfileValidation {
  readonly baseStructureStatus: "valid" | "invalid";
  readonly profileConformance: "not-evaluated" | "satisfied" | "not-satisfied" | "not-evaluable";
  readonly profileRef?: string;
  readonly issues: readonly {
    readonly path: string;
    readonly code: string;
    readonly message?: string;
  }[];
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
  readonly profileBindings?: readonly CapabilityProfileBinding[];
  readonly verifiers?: Readonly<Record<string, Verifier>>;
  readonly outputConnected?: boolean;
  readonly emit?: (event: CoreEvent) => void;
  readonly now?: () => number;
}
