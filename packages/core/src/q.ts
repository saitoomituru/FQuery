import type { QueryGoal, QueryInput, QueryNode, QueryOperation, QueryPolicy } from "./types.js";

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
  assertQueryNode(candidate);
  return Q(candidate.input, {
    queryId: candidate.queryId,
    operations: candidate.operations,
    ...(candidate.goal ? { goal: candidate.goal } : {}),
    policy: candidate.policy,
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
