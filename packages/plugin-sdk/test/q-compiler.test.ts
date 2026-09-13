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
  type FamTreeNode,
  type QCall,
} from "../src/q-compiler.js";
import { PluginRegistry, type PluginManifest } from "../src/index.js";

const atlantisCommons = JSON.parse(
  readFileSync(new URL("../../../refFAM/AtlantisCommons.refFAM.json", import.meta.url), "utf8"),
) as FamTreeNode;

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
    const effective = resolveEffectiveQ(atlantisCommons, resolvePathForScope([], "self"));
    expect(effective.plugin).toEqual(["@fam/stndio"]);
  });

  it("overrideしていないG5 Causalityはrootのpluginをそのまま継承する", () => {
    const effective = resolveEffectiveQ(atlantisCommons, resolvePathForScope(["G5 Causality"], "this"));
    expect(effective.plugin).toEqual(["@fam/stndio"]);
  });

  it("overrideしたG6 Positionは自分のQでshallow overrideされる(mergeではなく丸ごと差し替え)", () => {
    const effective = resolveEffectiveQ(atlantisCommons, resolvePathForScope(["G6 Position"], "this"));
    expect(effective.plugin).toEqual(["@fam/stndio", "@fam/magi-audit"]);
  });

  it("this.parentはrootへ一段戻る(G6のような1階層nestingではselfと同じ値になる)", () => {
    const effective = resolveEffectiveQ(atlantisCommons, resolvePathForScope(["G6 Position"], "this.parent"));
    expect(effective.plugin).toEqual(["@fam/stndio"]);
  });

  it("this.foldは未実装として例外を投げる(cross-document解決は別途設計が必要)", () => {
    expect(() => resolvePathForScope(["G6 Position"], "this.fold")).toThrow("q-scope-this-fold-not-yet-implemented");
  });

  it("resolveQForCallはcallのscopeへ従って解決する", () => {
    const call: QCall = { key: "Q(this).file.fit", scope: "this", method: "file.fit", args: ["Position/*.reffam.json"] };
    const effective = resolveQForCall(atlantisCommons, ["G6 Position"], call);
    expect(effective.plugin).toEqual(["@fam/stndio", "@fam/magi-audit"]);
  });

  it("存在しないpath segmentはtree-path-not-foundで例外を投げる", () => {
    expect(() => resolveEffectiveQ(atlantisCommons, ["G9 Nonexistent"])).toThrow("q-fam-tree-path-not-found");
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
    const { queryNode, profileBindings } = compileQCall(call!, effectiveQ, { queryId: "q://test/g7-file-fit" });

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

  it("reject時も例外を投げずpluginStatus:rejected+構造化lastOrderで返る(戻り値契約の実証)", async () => {
    const call: QCall = { key: "Q(self).file.fit", scope: "self", method: "file.fit", args: ["blocked/*.reffam.json"] };
    const effectiveQ = resolveEffectiveQ(atlantisCommons, []);
    const { queryNode, profileBindings } = compileQCall(call, effectiveQ, { queryId: "q://test/rejected" });

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
