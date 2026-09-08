import type {
  CoreEvent,
  EvaluationContext,
  QueryNode,
  QueryResult,
  StatusAxes,
  VerificationResult,
} from "./types.js";

interface EvaluationState {
  readonly startedAt: number;
  readonly deadline: number;
  readonly limits: QueryNode["policy"]["limits"];
  readonly active: Set<string>;
  readonly bindings: Map<string, unknown>;
  nodes: number;
}

export async function evaluateQ(query: QueryNode, context: EvaluationContext = {}): Promise<QueryResult> {
  const now = context.now ?? Date.now;
  const startedAt = now();
  return evaluateNode(query, context, {
    startedAt,
    deadline: startedAt + query.policy.limits.timeoutMs,
    limits: query.policy.limits,
    active: new Set<string>(),
    bindings: new Map(Object.entries(context.bindings ?? {})),
    nodes: 0,
  }, 0);
}

async function evaluateNode(
  query: QueryNode,
  context: EvaluationContext,
  state: EvaluationState,
  depth: number,
): Promise<QueryResult> {
  emit(context, { eventType: "query-received", queryRef: query.queryId, status: "received" });
  const limitResult = checkLimits(query, context, state, depth);
  if (limitResult) return limitResult;
  if (state.active.has(query.queryId)) return bottom(query, context, "cycle-detected");

  state.nodes += 1;
  state.active.add(query.queryId);
  try {
    const resolved = await resolveInput(query, context, state, depth);
    if (isTerminal(resolved)) return resolved;
    let value = resolved.value;
    let axes = resolved.axes;
    let evidenceRefs: readonly string[] = [];
    let verification: VerificationResult | undefined;

    for (const operation of query.operations) {
      if (operation.kind === "select") {
        const selected = selectPath(value, operation.path);
        if (!selected.found) return bottom(query, context, "mapping-unavailable");
        value = selected.value;
      } else if (operation.kind === "bind") {
        state.bindings.set(operation.name, value);
        emit(context, { eventType: "bind", queryRef: query.queryId, status: "resolved", detail: { name: operation.name } });
      } else if (operation.kind === "project") {
        if (!value || typeof value !== "object" || Array.isArray(value)) return bottom(query, context, "projection-input-not-object");
        const record = value as Record<string, unknown>;
        value = Object.fromEntries(operation.fields.filter((field) => field in record).map((field) => [field, record[field]]));
        emit(context, { eventType: "projection", queryRef: query.queryId, status: "resolved" });
      } else if (operation.kind === "invoke") {
        const invoked = await invokeCapability(query, operation.capability, value, context, state.deadline);
        if (isQueryResult(invoked)) return invoked;
        value = invoked.value;
        axes = { ...axes, transportStatus: invoked.transportStatus, pluginStatus: invoked.pluginStatus ?? "resolved" };
        evidenceRefs = [...evidenceRefs, ...(invoked.evidenceRefs ?? [])];
      } else if (operation.kind === "validate") {
        verification = await runVerifier(query, operation.verifierRef, value, context);
      }
    }

    const verifierRef = query.goal?.verifierRef;
    if (!verification && verifierRef) verification = await runVerifier(query, verifierRef, value, context);
    const completed = completeAxes(axes, query, verification, context.outputConnected);
    evidenceRefs = [...evidenceRefs, ...(verification?.evidenceRefs ?? [])];
    const result: QueryResult = {
      ...completed,
      queryRef: query.queryId,
      value,
      evidenceRefs,
      ...(verification?.validVariation ? { variationStatus: "valid-variation" as const } : {}),
    };
    emit(context, { eventType: "result", queryRef: query.queryId, status: result.controlStatus });
    return result;
  } finally {
    state.active.delete(query.queryId);
  }
}

function checkLimits(query: QueryNode, context: EvaluationContext, state: EvaluationState, depth: number): QueryResult | undefined {
  const now = context.now ?? Date.now;
  const reason = depth > state.limits.maxDepth
    ? "max-depth-exceeded"
    : state.nodes >= state.limits.maxNodes
      ? "max-nodes-exceeded"
      : now() > state.deadline
        ? "timeout-exceeded"
        : undefined;
  if (!reason) return undefined;
  const result: QueryResult = {
    ...initialAxes(context.outputConnected),
    resolutionStatus: "unknown",
    controlStatus: "last-order",
    queryRef: query.queryId,
    reason,
    evidenceRefs: [],
    lastOrder: {
      code: "FQUERY-RESOURCE-LIMIT",
      reason,
      requestedNext: "increase-limit-or-select-another-route",
      resumeWhen: "explicit-policy-update",
    },
  };
  emit(context, { eventType: "last-order", queryRef: query.queryId, status: reason });
  return result;
}

async function resolveInput(
  query: QueryNode,
  context: EvaluationContext,
  state: EvaluationState,
  depth: number,
): Promise<{ readonly value: unknown; readonly axes: StatusAxes } | QueryResult> {
  if (query.input.kind === "literal") return { value: query.input.value, axes: { ...initialAxes(context.outputConnected), resolutionStatus: "resolved" } };
  if (query.input.kind === "binding") {
    if (!state.bindings.has(query.input.name)) return unknown(query, context, "binding-not-found");
    return { value: state.bindings.get(query.input.name), axes: { ...initialAxes(context.outputConnected), resolutionStatus: "resolved" } };
  }
  const nested = await context.queryResolver?.(query.input.queryRef);
  if (!nested) return unknown(query, context, "query-ref-not-found");
  const nestedResult = await evaluateNode(nested, context, state, depth + 1);
  if (nestedResult.controlStatus !== "result") return nestedResult;
  return { value: nestedResult.value, axes: nestedResult };
}

async function invokeCapability(query: QueryNode, capability: string, value: unknown, context: EvaluationContext, deadline: number) {
  emit(context, { eventType: "plugin-resolve", queryRef: query.queryId, status: "requested", detail: { capability } });
  if (!context.pluginResolver) return pluginNotFound(query, context, capability);
  emit(context, { eventType: "plugin-call-start", queryRef: query.queryId, status: "running", detail: { capability } });
  const remainingMs = Math.max(1, deadline - (context.now ?? Date.now)());
  const controller = new AbortController();
  const timeout = Symbol("plugin-timeout");
  let timer: ReturnType<typeof setTimeout> | undefined;
  let result: Awaited<ReturnType<NonNullable<EvaluationContext["pluginResolver"]>["invoke"]>>;
  try {
    const invocation = context.pluginResolver.invoke({
      queryRef: query.queryId,
      capability,
      input: value,
      sideEffect: query.policy.sideEffect,
      ...(context.profileBindings ? { profileBindings: context.profileBindings } : {}),
      signal: controller.signal,
    });
    const timed = new Promise<typeof timeout>((resolve) => {
      timer = setTimeout(() => { controller.abort("timeout-exceeded"); resolve(timeout); }, remainingMs);
    });
    const settled = await Promise.race([invocation, timed]);
    if (settled === timeout) {
      emit(context, { eventType: "plugin-call-end", queryRef: query.queryId, status: "timeout-exceeded", detail: { capability, reason: "timeout-exceeded", timeoutMs: query.policy.limits.timeoutMs } });
      return resourceLimit(query, context, "timeout-exceeded");
    }
    result = settled;
  } catch (error) {
    const reason = error instanceof DOMException && error.name === "AbortError" ? "timeout-exceeded" : "plugin-call-threw";
    emit(context, { eventType: "plugin-call-end", queryRef: query.queryId, status: reason, detail: { capability, reason } });
    return reason === "timeout-exceeded" ? resourceLimit(query, context, reason) : pluginCallFailed(query, context, reason);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
  if (!result) return pluginNotFound(query, context, capability);
  emit(context, { eventType: "plugin-call-end", queryRef: query.queryId, status: result.transportStatus, detail: { capability, pluginId: result.pluginId, ...(result.outputStatus ? { outputStatus: result.outputStatus } : {}), ...(result.reason ? { reason: result.reason } : {}), ...(result.profileReceipts ? { profileReceipts: result.profileReceipts } : {}), ...(result.normalization ? { normalization: result.normalization } : {}), ...(result.execution ? { execution: result.execution } : {}) } });
  if (result.transportStatus === "failed") {
    const rejected = result.pluginStatus === "rejected";
    return {
      ...initialAxes(context.outputConnected),
      resolutionStatus: "resolved" as const,
      pluginStatus: rejected ? "rejected" as const : "resolved" as const,
      transportStatus: "failed" as const,
      semanticStatus: "unknown" as const,
      lambdaStatus: "unknown" as const,
      controlStatus: "last-order" as const,
      queryRef: query.queryId,
      reason: result.reason ?? "plugin-call-failed",
      evidenceRefs: result.evidenceRefs ?? [],
      lastOrder: {
        code: rejected ? "FQUERY-PLUGIN-REJECTED" : "FQUERY-PLUGIN-CALL-FAILED",
        reason: result.reason ?? "plugin-call-failed",
        requestedNext: "inspect-plugin-or-select-another-route",
        resumeWhen: "plugin-route-available",
      },
    } satisfies QueryResult;
  }
  if (result.outputStatus === "invalid") {
    const reason = result.reason ?? "plugin-output-invalid";
    return {
      ...initialAxes(context.outputConnected),
      resolutionStatus: "unknown" as const,
      pluginStatus: "resolved" as const,
      transportStatus: "succeeded" as const,
      semanticStatus: "unknown" as const,
      lambdaStatus: "unknown" as const,
      controlStatus: "last-order" as const,
      queryRef: query.queryId,
      reason,
      evidenceRefs: result.evidenceRefs ?? [],
      lastOrder: {
        code: "FQUERY-PLUGIN-OUTPUT-INVALID",
        reason,
        requestedNext: "inspect-provider-output-or-select-another-route",
        resumeWhen: "valid-provider-output-available",
      },
    } satisfies QueryResult;
  }
  return result;
}

function resourceLimit(query: QueryNode, context: EvaluationContext, reason: string): QueryResult {
  return {
    ...initialAxes(context.outputConnected),
    resolutionStatus: "unknown",
    transportStatus: "unknown",
    semanticStatus: "unknown",
    lambdaStatus: "unknown",
    controlStatus: "last-order",
    queryRef: query.queryId,
    reason,
    evidenceRefs: [],
    lastOrder: { code: "FQUERY-RESOURCE-LIMIT", reason, requestedNext: "increase-limit-or-select-another-route", resumeWhen: "explicit-policy-update" },
  };
}

function pluginCallFailed(query: QueryNode, context: EvaluationContext, reason: string): QueryResult {
  return {
    ...initialAxes(context.outputConnected),
    resolutionStatus: "resolved",
    pluginStatus: "resolved",
    transportStatus: "failed",
    semanticStatus: "unknown",
    lambdaStatus: "unknown",
    controlStatus: "last-order",
    queryRef: query.queryId,
    reason,
    evidenceRefs: [],
    lastOrder: { code: "FQUERY-PLUGIN-CALL-FAILED", reason, requestedNext: "inspect-plugin-or-select-another-route", resumeWhen: "plugin-route-available" },
  };
}

async function runVerifier(query: QueryNode, verifierRef: string, value: unknown, context: EvaluationContext): Promise<VerificationResult> {
  const verifier = context.verifiers?.[verifierRef];
  if (!verifier) {
    emit(context, { eventType: "unknown", queryRef: query.queryId, status: "verifier-not-found", detail: { verifierRef } });
    return { satisfied: false, evidenceRefs: [] };
  }
  const result = await verifier(value, query.goal?.lambdaRef ?? "lambda://unspecified");
  emit(context, { eventType: "semantic-check", queryRef: query.queryId, status: result.satisfied ? "satisfied" : "semantic-unsatisfied", detail: { verifierRef } });
  return result;
}

function completeAxes(axes: StatusAxes, query: QueryNode, verification: VerificationResult | undefined, outputConnected: boolean | undefined): StatusAxes {
  const connectionStatus = outputConnected === undefined ? axes.connectionStatus : outputConnected ? "connected" : "unconnected";
  if (!query.goal) return { ...axes, connectionStatus, controlStatus: "result" };
  if (!query.goal.verifierRef && !verification) {
    return { ...axes, connectionStatus, semanticStatus: "unknown", lambdaStatus: "unknown", controlStatus: "result" };
  }
  if (!verification?.evidenceRefs.length) {
    return { ...axes, connectionStatus, semanticStatus: "unknown", lambdaStatus: "unknown", controlStatus: "result" };
  }
  return {
    ...axes,
    connectionStatus,
    semanticStatus: verification.satisfied ? "satisfied" : "semantic-unsatisfied",
    lambdaStatus: verification.satisfied ? "satisfied" : "unsatisfied",
    controlStatus: "result",
  };
}

function initialAxes(outputConnected: boolean | undefined): StatusAxes {
  return {
    resolutionStatus: "unresolved",
    connectionStatus: outputConnected === undefined ? "not-applicable" : outputConnected ? "connected" : "unconnected",
    transportStatus: "not-started",
    pluginStatus: "not-requested",
    semanticStatus: "not-evaluated",
    lambdaStatus: "not-evaluated",
    controlStatus: "continue",
  };
}

function bottom(query: QueryNode, context: EvaluationContext, reason: string): QueryResult {
  const result: QueryResult = { ...initialAxes(context.outputConnected), resolutionStatus: "bottom", controlStatus: "bottom", queryRef: query.queryId, reason, evidenceRefs: [] };
  emit(context, { eventType: "bottom", queryRef: query.queryId, status: reason });
  return result;
}

function unknown(query: QueryNode, context: EvaluationContext, reason: string): QueryResult {
  const result: QueryResult = { ...initialAxes(context.outputConnected), resolutionStatus: "unknown", semanticStatus: "unknown", lambdaStatus: "unknown", controlStatus: "result", queryRef: query.queryId, reason, evidenceRefs: [] };
  emit(context, { eventType: "unknown", queryRef: query.queryId, status: reason });
  return result;
}

function pluginNotFound(query: QueryNode, context: EvaluationContext, capability: string): QueryResult {
  const reason = `plugin-not-found:${capability}`;
  const result: QueryResult = {
    ...initialAxes(context.outputConnected),
    resolutionStatus: "unresolved",
    pluginStatus: "plugin-not-found",
    semanticStatus: "unknown",
    lambdaStatus: "unknown",
    controlStatus: "last-order",
    queryRef: query.queryId,
    reason,
    evidenceRefs: [],
    lastOrder: { code: "FQUERY-PLUGIN-NOT-FOUND", reason, requestedNext: "provide-capability-or-select-another-route", resumeWhen: "plugin-capability-available" },
  };
  emit(context, { eventType: "last-order", queryRef: query.queryId, status: reason });
  return result;
}

function selectPath(value: unknown, path: readonly (string | number)[]): { readonly found: boolean; readonly value?: unknown } {
  let current = value;
  for (const segment of path) {
    if (current === null || typeof current !== "object" || !(segment in current)) return { found: false };
    current = (current as Record<string | number, unknown>)[segment];
  }
  return { found: true, value: current };
}

function isQueryResult(value: unknown): value is QueryResult {
  return Boolean(value && typeof value === "object" && "controlStatus" in value && "queryRef" in value);
}

function isTerminal(value: { readonly value: unknown; readonly axes: StatusAxes } | QueryResult): value is QueryResult {
  return isQueryResult(value);
}

function emit(context: EvaluationContext, event: CoreEvent): void {
  context.emit?.(event);
}
