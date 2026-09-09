import type { QueryGoal, QueryInput, QueryNode, QueryOperation, QueryPolicy, QueryResult } from "./types.js";

const DEFAULT_POLICY: QueryPolicy = {
  sideEffect: "deny",
  unknown: "retain",
  unresolved: "retain",
  limits: {
    maxDepth: 32,
    maxNodes: 10_000,
    timeoutMs: 30_000,
  },
};

export interface QOptions {
  readonly queryId: string;
  readonly operations?: readonly QueryOperation[];
  readonly goal?: QueryGoal;
  readonly policy?: Partial<QueryPolicy> & { readonly limits?: Partial<QueryPolicy["limits"]> };
}

export function Q(input: QueryInput, options: QOptions): QueryNode {
  const policy: QueryPolicy = {
    ...DEFAULT_POLICY,
    ...options.policy,
    limits: {
      ...DEFAULT_POLICY.limits,
      ...options.policy?.limits,
    },
  };
  const node: QueryNode = {
    schemaVersion: "fquery/0.1.0-draft",
    queryId: options.queryId,
    operator: "Q",
    input,
    operations: Object.freeze([...(options.operations ?? [])]),
    ...(options.goal ? { goal: Object.freeze({ ...options.goal }) } : {}),
    policy: Object.freeze({ ...policy, limits: Object.freeze({ ...policy.limits }) }),
  };
  return Object.freeze(node);
}

export function parseQuery(source: string | unknown): QueryNode {
  let candidate: unknown = source;
  if (typeof source === "string") {
    const trimmed = source.trim();
    const payload = trimmed.startsWith("Q(") && trimmed.endsWith(")") ? trimmed.slice(2, -1) : trimmed;
    candidate = JSON.parse(payload) as unknown;
  }
  if (isRecord(candidate) && candidate.schema_version === "fquery/0.1.0-draft") candidate = fromWireQuery(candidate);
  assertQueryNode(candidate);
  return Q(candidate.input, {
    queryId: candidate.queryId,
    operations: candidate.operations,
    ...(candidate.goal ? { goal: candidate.goal } : {}),
    policy: candidate.policy,
  });
}

export function toWireQueryResult(result: QueryResult): Readonly<Record<string, unknown>> {
  return Object.freeze({
    schema_version: "fquery.result/0.1.0-draft",
    query_ref: result.queryRef,
    resolution_status: result.resolutionStatus,
    connection_status: result.connectionStatus,
    transport_status: result.transportStatus,
    plugin_status: result.pluginStatus,
    semantic_status: result.semanticStatus,
    lambda_status: result.lambdaStatus,
    control_status: result.controlStatus,
    ...(result.value !== undefined ? { value: result.value } : {}),
    ...(result.candidate !== undefined ? { candidate: result.candidate } : {}),
    ...(result.profileValidation ? { profile_validation: result.profileValidation } : {}),
    ...(result.reason ? { reason: result.reason } : {}),
    evidence_refs: [...result.evidenceRefs],
    ...(result.variationStatus ? { variation_status: result.variationStatus } : {}),
    ...(result.lastOrder ? {
      last_order: {
        code: result.lastOrder.code,
        reason: result.lastOrder.reason,
        requested_next: result.lastOrder.requestedNext,
        resume_when: result.lastOrder.resumeWhen,
      },
    } : {}),
  });
}

function assertQueryNode(value: unknown): asserts value is QueryNode {
  if (!value || typeof value !== "object") throw new TypeError("Q query must be an object");
  const node = value as Partial<QueryNode>;
  if (node.schemaVersion !== "fquery/0.1.0-draft") throw new TypeError("unsupported schemaVersion");
  if (node.operator !== "Q") throw new TypeError("operator must be Q");
  if (typeof node.queryId !== "string" || node.queryId.length === 0) throw new TypeError("queryId is required");
  if (!node.input || typeof node.input !== "object") throw new TypeError("input is required");
  if (!Array.isArray(node.operations)) throw new TypeError("operations must be an array");
  if (!node.policy || typeof node.policy !== "object") throw new TypeError("policy is required");
}

function fromWireQuery(value: Record<string, unknown>): QueryNode {
  const input = fromWireInput(requiredRecord(value, "input"));
  const operations = requiredArray(value, "operations").map((operation) => fromWireOperation(asRecord(operation, "operation")));
  const goalValue = value.goal;
  const goal = goalValue === undefined ? undefined : fromWireGoal(asRecord(goalValue, "goal"));
  const policyValue = value.policy;
  const policy = policyValue === undefined ? undefined : fromWirePolicy(asRecord(policyValue, "policy"));
  return Q(input, {
    queryId: requiredString(value, "query_id"),
    operations,
    ...(goal ? { goal } : {}),
    ...(policy ? { policy } : {}),
  });
}

function fromWireInput(value: Record<string, unknown>): QueryInput {
  if (value.kind === "literal") return { kind: "literal", value: value.value };
  if (value.kind === "binding") return { kind: "binding", name: requiredString(value, "name") };
  if (value.kind === "query-ref") return { kind: "query-ref", queryRef: requiredString(value, "query_ref") };
  throw new TypeError("unsupported input kind");
}

function fromWireOperation(value: Record<string, unknown>): QueryOperation {
  if (value.kind === "select") return { kind: "select", path: requiredArray(value, "path") as (string | number)[] };
  if (value.kind === "bind") return { kind: "bind", name: requiredString(value, "name") };
  if (value.kind === "project") return { kind: "project", fields: requiredArray(value, "fields").map((field) => asString(field, "field")) };
  if (value.kind === "invoke") return { kind: "invoke", capability: requiredString(value, "capability") };
  if (value.kind === "validate") return { kind: "validate", verifierRef: requiredString(value, "verifier_ref") };
  throw new TypeError("unsupported operation kind");
}

function fromWireGoal(value: Record<string, unknown>): QueryGoal {
  const verifierRef = value.verifier_ref;
  return { lambdaRef: requiredString(value, "lambda_ref"), ...(typeof verifierRef === "string" ? { verifierRef } : {}) };
}

function fromWirePolicy(value: Record<string, unknown>): Partial<QueryPolicy> & { limits?: Partial<QueryPolicy["limits"]> } {
  const limits = requiredRecord(value, "limits");
  return {
    sideEffect: requiredString(value, "side_effect") as QueryPolicy["sideEffect"],
    unknown: requiredString(value, "unknown") as "retain",
    unresolved: requiredString(value, "unresolved") as "retain",
    limits: {
      maxDepth: requiredNumber(limits, "max_depth"),
      maxNodes: requiredNumber(limits, "max_nodes"),
      timeoutMs: requiredNumber(limits, "timeout_ms"),
    },
  };
}

function requiredRecord(value: Record<string, unknown>, key: string): Record<string, unknown> {
  return asRecord(value[key], key);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object`);
  return value;
}

function requiredArray(value: Record<string, unknown>, key: string): unknown[] {
  if (!Array.isArray(value[key])) throw new TypeError(`${key} must be an array`);
  return value[key];
}

function requiredString(value: Record<string, unknown>, key: string): string {
  return asString(value[key], key);
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(`${label} must be a string`);
  return value;
}

function requiredNumber(value: Record<string, unknown>, key: string): number {
  if (typeof value[key] !== "number" || !Number.isFinite(value[key])) throw new TypeError(`${key} must be a finite number`);
  return value[key];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
