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

## `sample3-1.fam.json` / `sample3-2.fam.json`

目的: **企業内tool-level FAMをmodule / submoduleへ分割し、L構造とmL実行経路を分離する最小例**を示す。

```text
sample3-1.fam.json
Corporate / 案件 FAM

開発部 --next--> 製造
                 │
                 └─ fam_ref -> ./sample3-2.fam.json

runtime:
製造 --after--> 法務部 --after--> QA --after--> 開発部
```

```text
sample3-2.fam.json
Manufacturing submodule

製造
  ├─ 製造1課
  └─ 製造2課
       ↓ mL after
    製造3課
```

- `sample3-1.fam.json`が親FAM module
- `sample3-2.fam.json`が製造Fold / submodule
- 親の`製造`nodeは`fam_ref`で子FAMを参照する。参照先を親JSONへinline copyしない
- 子FAMのroot `λ`は処理結果を返す。`this.parent`でmodule boundaryを暗黙横断しない
- `開発部 -> 製造`の`next / prev`はL軸のstructural position
- `製造 -> 法務部 -> QA -> 開発部`の`after / before`はmL軸の実行route
- `製造1課 / 製造2課`は同一製造node配下のparallel sibling
- QAから開発部へのrollbackはstructural nextではなくruntime `after`として表現する
- 法務部、QA、製造部等の意味・権限・規程内容はCoreへhard-codeしない。Corporate Fold用refFAM / Registry / adapter側が定義する

### directory / module hierarchy

同じmodule graphは、Node.jsのpackage / submoduleと同様にdirectory hierarchyへ写像してよい。

例:

```text
sample3/
  index.fam.json
  manufacturing/
    index.fam.json
```

この場合も意味は同じで、folder containmentそのものをsemantic truthへ昇格しない。module resolverが`fam_ref`を解決し、FAM identity / Fold boundaryを保持する。

```text
directory hierarchy
!= semantic authority

module resolution
!= inline copy
```

このsampleでは規約を最小表示するため、flatな`sample3-1.fam.json` / `sample3-2.fam.json`を使用する。

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

これらは**FAM selector / Topology Normalizer規約のサンプル**であり、`validateFamDecomposition()`のprovider profile適合fixtureではない。歴史的sample表記の`Ψ`も入力互換として保持し、FAM Core正本のbase axis `ψ`へ無断rewriteしない。

Issue #43のCore実装候補はdecomposition profileからroot `∇φ=array`固定を外した。ただしsample1〜3はprovider用metadataやlineageを意図的に持たないため、decomposition profileの`not-satisfied`とTopology normalizationの成否を混同しない。

sampleを旧provider profileへ合わせてarray化しない。base FAM構造、container representation、semantic/runtime topology、module resolutionは別状態として検証する。

関連:
- `docs/specification/fquery-selector-traversal-normalization.ja.md`
- Issue #43
