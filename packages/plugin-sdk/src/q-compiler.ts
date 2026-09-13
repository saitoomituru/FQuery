import type { CapabilityProfileBinding, LastOrder, QueryNode } from "@fquery/core";
import { Q as buildQueryNode } from "@fquery/core";

/**
 * Issue #41ブレスト(2026-09-13)のQ(scope).method(args)記法を、
 * 既存Q operator(QueryNode/evaluateQ、packages/core/src/q.ts, evaluator.ts)へ
 * lowerするcompiler。Issue #49で決定した通り、QueryInput/QueryOperationの
 * 閉じたunion型は変更しない。scope解決(self/this/parent/fold)はここで行い、
 * 結果はEvaluationContext.profileBindings経由でevaluateQ()へ渡す。
 *
 * Issue #50: 無限/循環参照は防ぐのではなく、どこで・なぜ打ち切ったかを
 * `⊥`(Core既存のLastOrder形状を再利用)として非破壊的に記録する。解決不能な
 * scope(this.foldの現状、根でのthis.parent、存在しないpath)は例外を投げず、
 * すべて{status:"bottom", lastOrder}を返す。詳細:
 * docs/specification/fam-q-declaration-execution.ja.md §7
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

/** 解決成功、または非破壊的な打ち切り(⊥/LastOrder)のどちらかを表す。 */
export type Bottomed<T> =
  | { readonly status: "resolved"; readonly value: T }
  | { readonly status: "bottom"; readonly lastOrder: LastOrder };

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
 * this.foldは別refFAM文書を跨ぐ識別アルゴリズムがIssue #50で未確定のため、
 * 例外ではなく`⊥`(bottom)として返す(未実装であることを隠さない)。
 */
export function resolvePathForScope(targetPath: readonly string[], scope: QScope): Bottomed<readonly string[]> {
  switch (scope) {
    case "self": return { status: "resolved", value: [] };
    case "this": return { status: "resolved", value: targetPath };
    case "this.parent": {
      if (targetPath.length === 0) {
        return {
          status: "bottom",
          lastOrder: {
            code: "FQUERY-FOLD-NO-PARENT-AT-ROOT",
            reason: "self-is-root-and-has-no-parent",
            requestedNext: "use-self-or-this-scope-instead",
            resumeWhen: "not-applicable-at-root",
          },
        };
      }
      return { status: "resolved", value: targetPath.slice(0, -1) };
    }
    case "this.fold":
      return {
        status: "bottom",
        lastOrder: {
          code: "FQUERY-FOLD-SCOPE-NOT-YET-IMPLEMENTED",
          reason: "cross-document-fold-identity-undecided(issue-50)",
          requestedNext: "track-issue-50-design-decision",
          resumeWhen: "this-fold-resolution-algorithm-decided",
        },
      };
  }
}

/**
 * rootからpathまでの各levelのQを、Vue provide/inject型のtree-scoped chainとして
 * shallow override合成する(deep-mergeしない、配列も丸ごと差し替え)。
 * chain[0]=self(root)、chain[last]=path終端のnode。innermostが各fieldを上書きする。
 * pathの途中に存在しないsegmentがあれば例外ではなく`⊥`を返す。
 */
export function resolveEffectiveQ(document: FamTreeNode, path: readonly string[]): Bottomed<Record<string, unknown>> {
  const chain: Record<string, unknown>[] = [isRecord(document.Q) ? document.Q : {}];
  let current: FamTreeNode = document;
  for (const segment of path) {
    const children = current["∇φ"];
    if (!isRecord(children) || !isRecord(children[segment])) {
      return {
        status: "bottom",
        lastOrder: {
          code: "FQUERY-FOLD-PATH-NOT-FOUND",
          reason: `segment-not-found:${segment}`,
          requestedNext: "inspect-∇φ-path-or-select-another-scope",
          resumeWhen: "path-corrected",
        },
      };
    }
    current = children[segment] as FamTreeNode;
    chain.push(isRecord(current.Q) ? current.Q : {});
  }
  return { status: "resolved", value: Object.assign({}, ...chain) };
}

/** callのscopeへ従って、document内のtargetPathから見た実効Qを解決する。 */
export function resolveQForCall(document: FamTreeNode, targetPath: readonly string[], call: QCall): Bottomed<Record<string, unknown>> {
  const scopePath = resolvePathForScope(targetPath, call.scope);
  if (scopePath.status === "bottom") return scopePath;
  return resolveEffectiveQ(document, scopePath.value);
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
 * QCall + 解決済みeffectiveQ(またはbottom)を、既存evaluateQ()がそのまま
 * 受け取れるQueryNode + profileBindingsへ変換する。effectiveQがbottomなら
 * そのまま`⊥`を伝播し、QueryNodeを組み立てない。
 */
export function compileQCall(call: QCall, effectiveQ: Bottomed<Record<string, unknown>>, options: CompileQCallOptions): Bottomed<CompiledQCall> {
  if (effectiveQ.status === "bottom") return effectiveQ;
  const queryNode = buildQueryNode(
    { kind: "literal", value: call.args },
    {
      queryId: options.queryId,
      operations: [{ kind: "invoke", capability: call.method }],
      policy: { sideEffect: options.sideEffect ?? "read" },
    },
  );
  return { status: "resolved", value: Object.freeze({ queryNode, profileBindings: pluginsToProfileBindings(effectiveQ.value) }) };
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
