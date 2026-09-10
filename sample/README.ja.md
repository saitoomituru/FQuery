# FAM 最小サンプル

このdirectoryのサンプルは、FAM / FQueryの基本記述規約を最小限の装飾で示す。

将来利用し得るmetadata、evidence、adapter候補、実装parameterを例示目的で盛らない。必要なprofileが追加要求する情報は、各profile / refFAM / Access Map / Q拡張側で扱う。

## `sample1.fam.json`

目的: **arrayによるparallel sibling representation**だけを示す。

```text
Ψ parent
  ├─ child A ─┐
  ├─ child B ─┼─> λ parent
  └─ child C ─┘
```

- rootと各unitはFAM base handshake `Ψ / ∇φ / λ / Q`を持つ
- `∇φ` arrayは同一parent配下のparallel collectionとして読む
- array indexだけからmL実行順を生成しない
- 各unitの`this.parent`はcurrent nodeからcurrent Fold内のparentを参照する

## `sample2.fam.json`

目的: **objectによるnamed/addressable unit**と、mL runtime traversalの最小形を示す。

```text
fact
  --after--> anxiety
  --after--> umbrella
```

- object key `fact / anxiety / umbrella`は局所的にaddressableなunit名
- `before / after`はmL軸で、実際の意味処理pipelineの前後を参照する
- `prev / next`はL軸のstructural position用であり、このサンプルでは使わない
- `.アストラル` / `.エレメンタル`は意味次元を操作するcommandではない。runtime traversal先をcurrent Foldのlayer namespaceでselector/filterする最小例
- `アストラル` / `エレメンタル`の意味定義はFQuery Coreの責務ではなく、active refFAM / Access Map / Registry側にある

## `sample3.tool-corporate.fam.json`

目的: **企業内tool-level FAMでL構造とmL実行経路が異なる最小例**を示す。

```text
L / structural
開発部 -> 製造 -> 製造3課
          ├─ 製造1課
          └─ 製造2課

mL / runtime
製造3課 -> 法務部 -> QA -> 開発部
```

- `開発部 / 製造 / 製造3課 / 法務部 / QA`はcurrent Corporate Fold内のnamed/addressable unit
- `製造1課 / 製造2課`は同一`製造`node配下のparallel sibling
- `this.prev / this.next`はL軸のstructural traversalを示す
- `this.before / this.after`は案件が実際に通過したmL runtime routeを示す
- QAから開発部へのrollbackは、structural nextではなく`this.after.開発部`として表現する
- 法務部やQAの意味・権限・安全基準そのものをCoreへhard-codeしない。企業用refFAM / Registry / adapter側が定義する
- 「安全基準を満たせない」という内容の正しさをこのfixture自体が証明するものではない。ここで示すのは、指摘を受けた案件がQA監修のもと開発部へ戻るroutingだけである

## `self` / `this`

```text
self = current FAM file / module
this = current node
```

`self != this`。

## Fold scope

selectorは既定でcurrent Fold内だけを解決する。

別Foldへ移る必要がある場合、semantic similarityだけで暗黙接続せず、`fam_ref` / 明示transition / adapter等のboundary contractを使う。

## 現行implementationとの状態差

これらは**FAM base / selector規約のサンプル**であり、現行`validateFamDecomposition()`の適合fixtureではない。

現行implementationはdecomposition profileで`∇φ=array`を要求しているため、`sample2.fam.json`および`sample3.tool-corporate.fam.json`はIssue #43の実装が入るまでdecomposition profileでは`not-satisfied`になり得る。

これはsample2 / sample3をarrayへ直す理由ではない。Issue #43で、base FAM構造、container representation、semantic/runtime topologyを分離して実装する。

関連:
- `docs/specification/fquery-selector-traversal-normalization.ja.md`
- Issue #43
