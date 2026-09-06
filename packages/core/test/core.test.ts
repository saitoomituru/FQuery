import { describe, expect, it } from "vitest";
import { evaluateQ, parseQuery, Q } from "../src/index.js";

describe("Q", () => {
  it("JSON ASTとQ(JSON) wrapperを同じQueryへ解析する", () => {
    const query = Q({ kind: "literal", value: { answer: 42 } }, { queryId: "q://test/parse", operations: [] });
    expect(parseQuery(JSON.stringify(query))).toEqual(query);
    expect(parseQuery(`Q(${JSON.stringify(query)})`)).toEqual(query);
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
});
