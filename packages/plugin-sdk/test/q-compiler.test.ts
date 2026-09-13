import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { evaluateQ } from "@fquery/core";
import {
  compileQCall,
  extractQCalls,
  parseQCallKey,
  resolveEffectiveQ,
  resolvePathForScope,
  resolveQForCall,
  type Bottomed,
  type CompiledQCall,
  type FamTreeNode,
  type QCall,
} from "../src/q-compiler.js";
import { createFoldLastOrderReceipt, validateFoldLastOrderReceipt } from "../src/fold-last-order.js";
import { PluginRegistry, type PluginManifest } from "../src/index.js";

const atlantisCommons = JSON.parse(
  readFileSync(new URL("../../../refFAM/AtlantisCommons.refFAM.json", import.meta.url), "utf8"),
) as FamTreeNode;

/** テスト内でstatus:"resolved"を前提にvalueを取り出す小道具。 */
function expectResolved<T>(result: Bottomed<T>): T {
  if (result.status === "bottom") throw new Error(`expected resolved but got bottom: ${JSON.stringify(result.lastOrder)}`);
  return result.value;
}

describe("parseQCallKey", () => {
  it("plain call形式を解析する", () => {
    expect(parseQCallKey("Q(self).file.fit")).toEqual({ scope: "self", method: "file.fit" });
  });

  it("sequence/or suffix付きのcallも解析する", () => {
    expect(parseQCallKey("Q(this).prompt.sequence")).toEqual({ scope: "this", method: "prompt.sequence" });
    expect(parseQCallKey("Q(this).prompt.or")).toEqual({ scope: "this", method: "prompt.or" });
    expect(parseQCallKey("Q(this.parent).prompt")).toEqual({ scope: "this.parent", method: "prompt" });
  });

  it("Q(scope).method形式でないkeyはundefinedを返す", () => {
    expect(parseQCallKey("label")).toBeUndefined();
    expect(parseQCallKey("Q")).toBeUndefined();
    expect(parseQCallKey("Q(unknown-scope).file.fit")).toBeUndefined();
  });
});

describe("extractQCalls", () => {
  it("実際のAtlantisCommons.refFAM.jsonのG7 World nodeからcallを抽出する", () => {
    const g7 = (atlantisCommons["∇φ"] as Record<string, FamTreeNode>)["G7 World"]!["∇φ"] as Record<string, unknown>;
    const calls = extractQCalls(g7);
    expect(calls).toEqual([
      { key: "Q(self).file.fit", scope: "self", method: "file.fit", args: ["world/*.reffam.json"] },
    ]);
  });
});

describe("resolveEffectiveQ / resolvePathForScope (tree-scoped shallow override)", () => {
  it("selfはrootのQのみ(pluginはstndioだけ)", () => {
    const effective = expectResolved(resolveEffectiveQ(atlantisCommons, expectResolved(resolvePathForScope([], "self"))));
    expect(effective.plugin).toEqual(["@fam/stndio"]);
  });

  it("overrideしていないG5 Causalityはrootのpluginをそのまま継承する", () => {
    const effective = expectResolved(resolveEffectiveQ(atlantisCommons, expectResolved(resolvePathForScope(["G5 Causality"], "this"))));
    expect(effective.plugin).toEqual(["@fam/stndio"]);
  });

  it("overrideしたG6 Positionは自分のQでshallow overrideされる(mergeではなく丸ごと差し替え)", () => {
    const effective = expectResolved(resolveEffectiveQ(atlantisCommons, expectResolved(resolvePathForScope(["G6 Position"], "this"))));
    expect(effective.plugin).toEqual(["@fam/stndio", "@fam/magi-audit"]);
  });

  it("this.parentはrootへ一段戻る(G6のような1階層nestingではselfと同じ値になる)", () => {
    const effective = expectResolved(resolveEffectiveQ(atlantisCommons, expectResolved(resolvePathForScope(["G6 Position"], "this.parent"))));
    expect(effective.plugin).toEqual(["@fam/stndio"]);
  });

  it("rootでthis.parentを引くと⊥(bottom)を返す(例外を投げない)", () => {
    const result = resolvePathForScope([], "this.parent");
    expect(result).toEqual({
      status: "bottom",
      lastOrder: {
        code: "FQUERY-FOLD-NO-PARENT-AT-ROOT",
        reason: "self-is-root-and-has-no-parent",
        requestedNext: "use-self-or-this-scope-instead",
        resumeWhen: "not-applicable-at-root",
      },
    });
  });

  it("this.foldは未実装として⊥(bottom)を返す(cross-document解決はIssue #50で未確定)", () => {
    const result = resolvePathForScope(["G6 Position"], "this.fold");
    expect(result.status).toBe("bottom");
    expect(result.status === "bottom" && result.lastOrder.code).toBe("FQUERY-FOLD-SCOPE-NOT-YET-IMPLEMENTED");
  });

  it("resolveQForCallはcallのscopeへ従って解決する", () => {
    const call: QCall = { key: "Q(this).file.fit", scope: "this", method: "file.fit", args: ["Position/*.reffam.json"] };
    const effective = expectResolved(resolveQForCall(atlantisCommons, ["G6 Position"], call));
    expect(effective.plugin).toEqual(["@fam/stndio", "@fam/magi-audit"]);
  });

  it("存在しないpath segmentは⊥(bottom)を返す(例外を投げない)", () => {
    const result = resolveEffectiveQ(atlantisCommons, ["G9 Nonexistent"]);
    expect(result).toEqual({
      status: "bottom",
      lastOrder: {
        code: "FQUERY-FOLD-PATH-NOT-FOUND",
        reason: "segment-not-found:G9 Nonexistent",
        requestedNext: "inspect-∇φ-path-or-select-another-scope",
        resumeWhen: "path-corrected",
      },
    });
  });
});

describe("⊥(bottom)のOAE last-order記録(Issue #50)", () => {
  it("bottomな解決結果をfold last-order OAE receiptとして記録できる", () => {
    const result = resolvePathForScope(["G6 Position"], "this.fold");
    if (result.status !== "bottom") throw new Error("expected bottom");
    const receipt = createFoldLastOrderReceipt({
      subjectRef: "Q(this.fold).file.fit@G6 Position",
      lastOrder: result.lastOrder,
      siblingRefs: ["Q(self).file.fit@G7 World", "Q(this).file.fit@G5 Causality"],
      now: () => new Date("2026-09-13T00:00:00.000Z"),
    });
    expect(validateFoldLastOrderReceipt(receipt).valid).toBe(true);
    expect(receipt).toEqual({
      schemaVersion: "fquery.fold-last-order/0.1.0-draft",
      subjectRef: "Q(this.fold).file.fit@G6 Position",
      lastOrder: result.lastOrder,
      siblingRefs: ["Q(self).file.fit@G7 World", "Q(this).file.fit@G5 Causality"],
      observedAt: "2026-09-13T00:00:00.000Z",
    });
  });

  it("兄弟枝は削除されず非ゼロサムで参照だけ残る(受け取ったsiblingRefsをそのまま保持)", () => {
    const receipt = createFoldLastOrderReceipt({
      subjectRef: "q://test/bottomed-branch",
      lastOrder: { code: "FQUERY-FOLD-CYCLE-DETECTED", reason: "test", requestedNext: "test", resumeWhen: "test" },
      siblingRefs: ["a", "b", "c"],
    });
    expect(receipt.siblingRefs).toEqual(["a", "b", "c"]);
  });
});

describe("compileQCall -> 既存evaluateQ()への統合", () => {
  const filePluginManifest: PluginManifest = {
    schemaVersion: "fquery.plugin/0.1.0-draft",
    pluginId: "plugin://test/fam-stdio",
    pluginVersion: "0.1.0",
    capabilities: ["file.fit"],
    accepts: ["application/json"],
    returns: ["application/json"],
    authority: { required: false, scopes: [] },
    sideEffect: "read",
    unknownPolicy: "retain",
    lastOrderPolicy: "return-envelope",
    implementation: { language: "typescript", runtime: "node" },
    famSupport: {
      schemaVersion: "fam.adapter-support/0.1.0-draft",
      level: 0,
      capabilityRefs: ["file.fit"],
      observationSurfaces: [],
      limitations: ["testでは実際のglob/fs読み込みを行わない"],
    },
  };

  it("Q(self).file.fitで抽出したcallをQueryNodeへcompileしevaluateQ()で実行できる", async () => {
    const g7 = (atlantisCommons["∇φ"] as Record<string, FamTreeNode>)["G7 World"]!["∇φ"] as Record<string, unknown>;
    const [call] = extractQCalls(g7);
    expect(call).toBeDefined();

    const effectiveQ = resolveQForCall(atlantisCommons, ["G7 World"], call!);
    const compiled: CompiledQCall = expectResolved(compileQCall(call!, effectiveQ, { queryId: "q://test/g7-file-fit" }));
    const { queryNode, profileBindings } = compiled;

    expect(profileBindings).toEqual([
      { profileRef: "@fam/stndio", revisionRef: "unknown", mediaType: "application/vnd.fquery.plugin-ref+json", roles: ["generation-constraint"], value: { pluginRef: "@fam/stndio" } },
    ]);

    const registry = new PluginRegistry();
    registry.register(filePluginManifest, ({ input }) => ({
      value: (input as readonly string[]).map((pattern) => ({ matchedGlob: pattern, fam: { ψ: "stub", "∇φ": {}, λ: "stub", Q: {} } })),
      transportStatus: "succeeded",
    }));

    const result = await evaluateQ(queryNode, { pluginResolver: registry, profileBindings });
    expect(result.pluginStatus).toBe("resolved");
    expect(result.transportStatus).toBe("succeeded");
    expect(result.value).toEqual([{ matchedGlob: "world/*.reffam.json", fam: { ψ: "stub", "∇φ": {}, λ: "stub", Q: {} } }]);
  });

  it("this.foldのようなbottomなscopeはcompileQCallの時点で⊥のまま伝播しQueryNodeを組み立てない", () => {
    const call: QCall = { key: "Q(this.fold).prompt", scope: "this.fold", method: "prompt", args: "ignored" };
    const effectiveQ = resolveQForCall(atlantisCommons, ["G6 Position"], call);
    const compiled = compileQCall(call, effectiveQ, { queryId: "q://test/fold-bottom" });
    expect(compiled).toEqual({
      status: "bottom",
      lastOrder: {
        code: "FQUERY-FOLD-SCOPE-NOT-YET-IMPLEMENTED",
        reason: "cross-document-fold-identity-undecided(issue-50)",
        requestedNext: "track-issue-50-design-decision",
        resumeWhen: "this-fold-resolution-algorithm-decided",
      },
    });
  });

  it("reject時も例外を投げずpluginStatus:rejected+構造化lastOrderで返る(戻り値契約の実証)", async () => {
    const call: QCall = { key: "Q(self).file.fit", scope: "self", method: "file.fit", args: ["blocked/*.reffam.json"] };
    const effectiveQ = resolveEffectiveQ(atlantisCommons, []);
    const compiled: CompiledQCall = expectResolved(compileQCall(call, effectiveQ, { queryId: "q://test/rejected" }));
    const { queryNode, profileBindings } = compiled;

    const registry = new PluginRegistry();
    registry.register(filePluginManifest, () => ({
      pluginStatus: "rejected",
      transportStatus: "failed",
      reason: "quarantine-boundary-violation",
    }));

    const result = await evaluateQ(queryNode, { pluginResolver: registry, profileBindings });
    // 例外は投げない。transportStatus:"failed"経路はreason/lastOrderのみ保持し、candidateは
    // このpathでは保持されない(candidate保持はoutputStatus:"profile-nonconformant"側の契約であり、
    // rejectedとcandidate保持は別軸。§5のUNKNOWN注記をこの実証結果に合わせて訂正する)。
    expect(result.pluginStatus).toBe("rejected");
    expect(result.reason).toBe("quarantine-boundary-violation");
    expect(result.lastOrder?.code).toBe("FQUERY-PLUGIN-REJECTED");
    expect(result.candidate).toBeUndefined();
  });
});
