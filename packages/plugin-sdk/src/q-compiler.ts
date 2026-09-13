import type { CapabilityProfileBinding, QueryNode } from "@fquery/core";
import { Q as buildQueryNode } from "@fquery/core";

/**
 * Issue #41ブレスト(2026-09-13)のQ(scope).method(args)記法を、
 * 既存Q operator(QueryNode/evaluateQ、packages/core/src/q.ts, evaluator.ts)へ
 * lowerするcompiler。Issue #49で決定した通り、QueryInput/QueryOperationの
 * 閉じたunion型は変更しない。scope解決(self/this/parent/fold)はここで行い、
 * 結果はEvaluationContext.profileBindings経由でevaluateQ()へ渡す。
 */

export type QScope = "self" | "this" | "this.parent" | "this.fold";

export interface QCall {
  readonly key: string;
  readonly scope: QScope;
  readonly method: string;
  readonly args: unknown;
}

export interface FamTreeNode {
  readonly Q?: Record<string, unknown>;
  readonly "∇φ"?: Record<string, unknown>;
  readonly [key: string]: unknown;
}

const Q_CALL_KEY_PATTERN = /^Q\((self|this|this\.parent|this\.fold)\)\.(.+)$/;

/** `"Q(self).file.fit"`のようなkeyをscope/methodへ分解する。マッチしないkeyはundefined。 */
export function parseQCallKey(key: string): { readonly scope: QScope; readonly method: string } | undefined {
  const match = Q_CALL_KEY_PATTERN.exec(key);
  if (!match || match[1] === undefined || match[2] === undefined) return undefined;
  return Object.freeze({ scope: match[1] as QScope, method: match[2] });
}

/** nodeの直下keyからQ(scope).method形式の呼び出しを全て抽出する。 */
export function extractQCalls(node: Record<string, unknown>): readonly QCall[] {
  const calls: QCall[] = [];
  for (const [key, value] of Object.entries(node)) {
    const parsed = parseQCallKey(key);
    if (!parsed) continue;
    calls.push(Object.freeze({ key, scope: parsed.scope, method: parsed.method, args: value }));
  }
  return Object.freeze(calls);
}

/**
 * scope keywordを、resolveEffectiveQへ渡すpath(rootからの∇φキー列)へ変換する。
 * this.foldは別refFAM文書を跨ぐ解決が必要でここでは未実装のため例外にする。
 */
export function resolvePathForScope(targetPath: readonly string[], scope: QScope): readonly string[] {
  switch (scope) {
    case "self": return [];
    case "this": return targetPath;
    case "this.parent": {
      if (targetPath.length === 0) throw new TypeError("q-scope-this-parent-has-no-parent-at-root");
      return targetPath.slice(0, -1);
    }
    case "this.fold": throw new TypeError("q-scope-this-fold-not-yet-implemented");
  }
}

/**
 * rootからpathまでの各levelのQを、Vue provide/inject型のtree-scoped chainとして
 * shallow override合成する(deep-mergeしない、配列も丸ごと差し替え)。
 * chain[0]=self(root)、chain[last]=path終端のnode。innermostが各fieldを上書きする。
 */
export function resolveEffectiveQ(document: FamTreeNode, path: readonly string[]): Record<string, unknown> {
  const chain: Record<string, unknown>[] = [isRecord(document.Q) ? document.Q : {}];
  let current: FamTreeNode = document;
  for (const segment of path) {
    const children = current["∇φ"];
    if (!isRecord(children) || !isRecord(children[segment])) {
      throw new TypeError(`q-fam-tree-path-not-found:${segment}`);
    }
    current = children[segment] as FamTreeNode;
    chain.push(isRecord(current.Q) ? current.Q : {});
  }
  return Object.assign({}, ...chain);
}

/** callのscopeへ従って、document内のtargetPathから見た実効Qを解決する。 */
export function resolveQForCall(document: FamTreeNode, targetPath: readonly string[], call: QCall): Record<string, unknown> {
  return resolveEffectiveQ(document, resolvePathForScope(targetPath, call.scope));
}

export interface CompiledQCall {
  readonly queryNode: QueryNode;
  readonly profileBindings: readonly CapabilityProfileBinding[];
}

export interface CompileQCallOptions {
  readonly queryId: string;
  readonly sideEffect?: QueryNode["policy"]["sideEffect"];
}

/**
 * QCall + 解決済みeffectiveQを、既存evaluateQ()がそのまま受け取れる
 * QueryNode + profileBindingsへ変換する。QueryNode自体はscopeを知らない
 * (scope解決はこの関数呼び出し前に完了している)。
 */
export function compileQCall(call: QCall, effectiveQ: Record<string, unknown>, options: CompileQCallOptions): CompiledQCall {
  const queryNode = buildQueryNode(
    { kind: "literal", value: call.args },
    {
      queryId: options.queryId,
      operations: [{ kind: "invoke", capability: call.method }],
      policy: { sideEffect: options.sideEffect ?? "read" },
    },
  );
  return Object.freeze({ queryNode, profileBindings: pluginsToProfileBindings(effectiveQ) });
}

/**
 * 暫定マッピング: Q.pluginの各参照をgeneration-constraint roleのlossless
 * profile bindingとして表現する。revisionRefを持たないためunknownとする。
 * pluginごとのrevision管理が決まり次第見直す(暫定実装であり正式契約ではない)。
 */
function pluginsToProfileBindings(effectiveQ: Record<string, unknown>): readonly CapabilityProfileBinding[] {
  const plugins = effectiveQ.plugin;
  if (!Array.isArray(plugins)) return Object.freeze([]);
  return Object.freeze(plugins.map((pluginRef): CapabilityProfileBinding => Object.freeze({
    profileRef: String(pluginRef),
    revisionRef: "unknown",
    mediaType: "application/vnd.fquery.plugin-ref+json",
    roles: ["generation-constraint"] as const,
    value: Object.freeze({ pluginRef }),
  })));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
