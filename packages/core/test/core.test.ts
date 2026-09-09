import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { evaluateQ, parseQuery, Q, toWireQueryResult } from "../src/index.js";

describe("Q", () => {
  it("JSON ASTとQ(JSON) wrapperを同じQueryへ解析する", () => {
    const query = Q({ kind: "literal", value: { answer: 42 } }, { queryId: "q://test/parse", operations: [] });
    expect(parseQuery(JSON.stringify(query))).toEqual(query);
    expect(parseQuery(`Q(${JSON.stringify(query)})`)).toEqual(query);
  });

  it("repositoryのsnake_case fixtureを公開wire contractとして解析する", () => {
    const fixture = JSON.parse(readFileSync(join(process.cwd(), "../../fixtures/benchmark/same-query.json"), "utf8")) as { query: unknown };
    const query = parseQuery(fixture.query);
    expect(query.queryId).toBe("q://fixture/benchmark");
    expect(query.goal?.lambdaRef).toBe("lambda://fixture/echo");
    expect(query.policy.limits.maxNodes).toBe(10_000);
  });

  it("内部camelCase resultをsnake_case wire envelopeへ明示変換する", async () => {
    const result = await evaluateQ(Q({ kind: "literal", value: 1 }, { queryId: "q://test/wire" }));
    expect(toWireQueryResult(result)).toMatchObject({
      schema_version: "fquery.result/0.1.0-draft",
      query_ref: "q://test/wire",
      resolution_status: "resolved",
      control_status: "result",
    });
  });

  it("selectとprojectを副作用なしで評価する", async () => {
    const input = { nested: { keep: 1, drop: 2 } };
    const query = Q(
      { kind: "literal", value: input },
      { queryId: "q://test/project", operations: [{ kind: "select", path: ["nested"] }, { kind: "project", fields: ["keep"] }] },
    );
    const result = await evaluateQ(query, { outputConnected: false });
    expect(result.value).toEqual({ keep: 1 });
    expect(result.connectionStatus).toBe("unconnected");
    expect(result.controlStatus).toBe("result");
    expect(input).toEqual({ nested: { keep: 1, drop: 2 } });
  });

  it("plugin無しのinvokeをLast Orderへ接続する", async () => {
    const query = Q({ kind: "literal", value: "hello" }, { queryId: "q://test/plugin-missing", operations: [{ kind: "invoke", capability: "echo" }] });
    const result = await evaluateQ(query);
    expect(result.pluginStatus).toBe("plugin-not-found");
    expect(result.controlStatus).toBe("last-order");
    expect(result.lastOrder?.code).toBe("FQUERY-PLUGIN-NOT-FOUND");
  });

  it("transport成功をlambda成功へ昇格しない", async () => {
    const query = Q(
      { kind: "literal", value: "hello" },
      { queryId: "q://test/lambda-unknown", operations: [{ kind: "invoke", capability: "echo" }], goal: { lambdaRef: "lambda://test/echo" } },
    );
    const result = await evaluateQ(query, {
      pluginResolver: { invoke: async () => ({ pluginId: "plugin://test/echo", value: "hello", transportStatus: "succeeded" }) },
    });
    expect(result.transportStatus).toBe("succeeded");
    expect(result.lambdaStatus).toBe("unknown");
  });

  it("base成立のprofile不適合candidateをtransport失敗や消失へ潰さない", async () => {
    const candidate = { ψ: "入力", "∇φ": [], λ: {}, Q: null, extra: { retained: true } };
    const result = await evaluateQ(Q(
      { kind: "literal", value: "入力" },
      { queryId: "q://test/profile-gap", operations: [{ kind: "invoke", capability: "fam.decompose" }] },
    ), { pluginResolver: { invoke: async () => ({
      pluginId: "plugin://test/decomposer",
      transportStatus: "succeeded",
      outputStatus: "profile-nonconformant",
      candidate,
      profileValidation: { baseStructureStatus: "valid", profileConformance: "not-satisfied", profileRef: "profile://test/decomposition", issues: [{ path: "$.kind", code: "string-required" }] },
    }) } });
    expect(result).toMatchObject({
      transportStatus: "succeeded",
      controlStatus: "last-order",
      candidate,
      lastOrder: { code: "FQUERY-PLUGIN-PROFILE-NONCONFORMANT" },
    });
    expect(toWireQueryResult(result)).toMatchObject({ candidate, profile_validation: { baseStructureStatus: "valid", profileConformance: "not-satisfied" } });
  });

  it("明示verifierとevidenceだけでlambda satisfiedになる", async () => {
    const query = Q(
      { kind: "literal", value: "hello" },
      { queryId: "q://test/lambda", operations: [], goal: { lambdaRef: "lambda://test/hello", verifierRef: "verifier://test/equal" } },
    );
    const result = await evaluateQ(query, {
      verifiers: { "verifier://test/equal": (value) => ({ satisfied: value === "hello", evidenceRefs: ["evidence://test/equal"] }) },
    });
    expect(result.semanticStatus).toBe("satisfied");
    expect(result.lambdaStatus).toBe("satisfied");
  });

  it("query-ref cycleをbottomとして停止する", async () => {
    const a = Q({ kind: "query-ref", queryRef: "q://test/b" }, { queryId: "q://test/a", operations: [] });
    const b = Q({ kind: "query-ref", queryRef: "q://test/a" }, { queryId: "q://test/b", operations: [] });
    const queries = new Map([[a.queryId, a], [b.queryId, b]]);
    const result = await evaluateQ(a, { queryResolver: (ref) => queries.get(ref) });
    expect(result.controlStatus).toBe("bottom");
    expect(result.reason).toBe("cycle-detected");
  });

  it("depth上限をLast Orderとして停止する", async () => {
    const a = Q({ kind: "query-ref", queryRef: "q://test/b" }, { queryId: "q://test/depth-a", operations: [], policy: { limits: { maxDepth: 0 } } });
    const b = Q({ kind: "literal", value: true }, { queryId: "q://test/b", operations: [] });
    const result = await evaluateQ(a, { queryResolver: () => b });
    expect(result.controlStatus).toBe("last-order");
    expect(result.reason).toBe("max-depth-exceeded");
  });

  it("応答しないpluginをQ deadlineで停止してLast Orderを返す", async () => {
    let receivedSignal: AbortSignal | undefined;
    const query = Q({ kind: "literal", value: "hello" }, { queryId: "q://test/timeout", operations: [{ kind: "invoke", capability: "hang" }], policy: { sideEffect: "network", limits: { timeoutMs: 10 } } });
    const result = await evaluateQ(query, { pluginResolver: { invoke: async (request) => {
      receivedSignal = request.signal;
      return await new Promise<never>(() => undefined);
    } } });
    expect(receivedSignal?.aborted).toBe(true);
    expect(result).toMatchObject({ transportStatus: "unknown", controlStatus: "last-order", reason: "timeout-exceeded", lastOrder: { code: "FQUERY-RESOURCE-LIMIT" } });
  });
});
