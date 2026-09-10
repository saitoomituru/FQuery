# FQuery selector / traversal / normalization 最小規約

状態: `CORE-IMPLEMENTATION-CANDIDATE / AUTOMATED-VERIFIED / HUMAN-TEST-PENDING`

関連:
- [`fam-json-core.ja.md`](fam-json-core.ja.md)
- [`fam-reference-boundary.ja.md`](fam-reference-boundary.ja.md)
- [`fold-boundary-runner.ja.md`](fold-boundary-runner.ja.md)
- [`../architecture/fam-reference-extraction.ja.md`](../architecture/fam-reference-extraction.ja.md)

## 0. 目的

FQueryを「自然言語を配列へ分解するJSON generator」ではなく、FAM module / node / Foldを既知のselector・object traversal感覚で参照する薄いQuery Surfaceとして固定する。

Coreは語の意味を宇宙的に裁定しない。Coreが機械拘束するのは、pointer、scope、Fold boundary、参照方向、revision、adapter capabilityである。

```text
Meaning may remain open.
Pointers may not.
```

## 1. scope primitive

```text
self
  = 現在のFAM file / FAM moduleそのもの

this
  = 現在評価・処理しているnodeそのもの
```

`self != this` を不変条件とする。

FAMを一枚の巨大JSONへflattenしない。FAM fileはmoduleとして扱い、別FAMへの接続は明示referenceを解決する。

## 2. structural traversal

基本object traversalは既知のDOM / jQuery / JS object操作感に寄せる。

```text
parent
children
prev
next
siblings
```

### L axis

`prev / next`はL軸の機械的・構造的position traversalである。

```text
prev <- this -> next
```

`prev / next`は「どこに配置・接続されているか」を指し、「今回どこから処理が来たか」を意味しない。

`parent / children`はcontainment / ownership scopeを辿る。Fold boundaryを暗黙に越えない。

## 3. runtime semantic traversal

### mL axis

`before / after`はmL軸の処理・解釈pipeline traversalである。

```text
before <- this -> after
```

`before / after`は実際の処理runでどこから来て、どこへ渡ったかを参照する。同じcanonical graphでもrunごとに変化し得る。

```text
L topology:
A -> B -> C

run-1 mL:
A -> C -> B

run-2 mL:
A -> B -> C
```

したがって:

```text
prev / next   = structural topology
before / after = resolved runtime semantic topology
```

runtime確定値はFAMLog / execution receiptとして保持できる。canonical FAMをrunごとに書き換える義務はない。

## 4. array と object

FAM最小正規形では、container shapeに次の役割を与える。

```text
array
  = sibling collection / parallel representation

object
  = 名前付きでaddressableなunit群 / selector対象
```

JSON arrayにはsyntax上のindex順が存在するが、FAMはarray indexだけからmL実行順を推論しない。依存・実処理順が必要なら`before / after`または明示された意味processor relationを使う。

object keyは局所selector identityとして利用できる。

## 5. selector と layer

layer名やdomain名の意味をCoreへhard-codeしない。

例:

```text
アストラル
エレメンタル
設計部
製造部
法務部
庶務
```

これらはactive refFAM / Access Map / Registryが現在Fold内で宣言するnamespaceである。

LLM / model / Human ObserverはrefFAMと比較して「このnodeはエレメンタルか」等を分類できる。

Core / IBD / adapterはその意味判断を行わず、判定済みの`layer_ref`、node ref、selectorを機械的に検索・検証する。

```text
semantic classification
  = LLM / model / Human + refFAM

pointer / selector resolution
  = Core / resolver / adapter
```

## 6. Fold scope

selector resolutionは既定でcurrent Fold scopedとする。

```text
same Fold
  -> parent / children / prev / next / before / after を解決可能

other Fold
  -> implicit traversal禁止
  -> fam_ref / 明示transition / adapter等のboundary契約を要求
```

同じselector文法を共有していてもWorld / Foldを共有しているとは限らない。

```text
syntax shared != scope shared
```

例:

```text
Self Fold
  アストラル / エレメンタル

Corporate Fold
  設計部 / 製造部 / 法務部 / 庶務 / 経営部
```

Corporate Foldから`アストラル`を暗黙探索したり、Self Foldから`法務部`を暗黙探索したりしない。active Registryで未解決なら`unresolved-selector`等として止める。

科学、主観、信仰、制度をFold境界なしにsemantic similarityだけで直結すると、仮説・測定・目的・合意のscopeが混線する。Coreは意味を裁定しなくても、cross-Fold pointerを機械拘束することでこのcategory errorを防ぐ。

## 7. FAM module / cross-file reference

FAM fileはmoduleとして扱う。

```text
self = current FAM module
fam_ref = external FAM module reference
```

参照はcopyではない。

```text
reference != inline copy != recursive expansion
```

循環参照が存在しても、resolverは`fam_ref + revision + visited/path`でmodule graphとして扱い、JSONを無限inline展開しない。

## 8. normalization と情報子抽出

入力構造はまずcurrent Fold内で、次の最小primitiveへlossless normalizationを試す。

```text
self / this
parent / children
prev / next
before / after
array parallel collection
object addressable unit
```

次のようにcurrent Fold内の基本操作だけではidentityを損なわず正規化できない場合、独立FAM extractionを実行する。

- 複数semantic consumerから同じ単位を参照する
- 別Foldから再参照する必要がある
- 独立revision / provenance / Q / lifecycleが必要
- inline展開すると循環・共有identity・scope混線が生じる
- Human / active profileが可搬単位として明示抽出する

```text
local structure
  -> lossless normalize possible
     -> current FAM内node

  -> independent identity required
     -> extract FAMJSON / Infoton module
     -> parentはfam_refを保持
```

抽出は「真理」「高価値」「叡智」の判定ではない。可搬identityを与える操作である。後からIBD / vector DB等へindexし、参照、採用、棄却、再利用ContextをOAE / FAMLogで統計できる。

## 9. objective fact / subjective truth query

Query dispatchの意味種別を最低限分ける。

```text
objective fact query
  -> fact-capable adapter
  -> API / SQL / RAG / sensor / record等
  -> 再取得・検証可能なsource / provenanceを返す

subjective truth query
  -> semantic / vector-capable adapter
  -> 経験・記憶・解釈等の意味近傍を返す
  -> Observerが採用 / 保留 / 棄却できる
```

backend製品名はCore契約ではない。

```text
retrieved != adopted
subjective validity != objective universality
```

「なぜ傘がないと不安か」は経験・記憶のsemantic retrievalになり得る。「今雨が降っているか」は観測API等のfact retrievalになり得る。

## 10. Node runtime / adapter responsibility

Node runtimeはFAMの意味を所有せず、module resolution、selector chain、plugin、async dispatch、adapter orchestrationのHostとして利用できる。

```text
FQuery surface
  -> selector parser
  -> Fold-scoped resolver
  -> normalized topology
  -> Runner / FAMLog
  -> adapter
  -> IBD / SQL / graph DB / vector DB / API / external system
```

`dependsOn`、GUI edge、DB query等を別々の意味正本にしない。いずれもFAM selector / topologyから投影される実装表現とする。

## 11. 最小acceptance criteria

- [ ] `self`がcurrent FAM module、`this`がcurrent nodeとして解決される
- [ ] `self != this`を回帰testする
- [ ] array siblingがparallel representationとして読める
- [ ] object keyをaddressable unitとしてselector解決できる
- [ ] `prev / next`をL軸structural traversalとして解決できる
- [ ] `before / after`をmL軸runtime traversalとして解決できる
- [ ] 同じnodeでL topologyとmL runtime routeが異なるcaseを保持できる
- [ ] selectorがFold boundaryを暗黙横断しない
- [ ] layer意味分類とpointer解決が別責務である
- [ ] cross-FAM referenceをcopyせずmodule resolveする
- [ ] current Foldでlossless normalization不能な共有構造を独立FAMへ抽出できる
- [ ] objective fact / subjective truthのadapter capabilityを混同しない
- [ ] `sample/sample1.fam.json`をparallel最小fixtureとして読める
- [ ] `sample/sample2.fam.json`をmL chain最小fixtureとして読める

## 12. non-goals

- `アストラル`、`エレメンタル`、企業部署、科学domain等の意味をCore enumへ固定する

- array indexを実行順へ自動昇格する
- `prev / next`と`before / after`を同義にする
- semantic similarityだけでFoldを横断する
- vector DB / SQL / Neo4j / IBD等の特定backendをFQuery Coreへ固定する
- LLMへpointer integrityやFold boundary enforcementを委譲する

## 13. 2026-09-11 Core実装receipt

次のCore候補を実装し、自動testへ接続した。

- `@fquery/fam-core`: decomposition profileのroot `∇φ=array`固定を解除
- `@fquery/core`: `normalizeFamTopology()`、Fold-scoped selector resolver、layer pointer validator
- `@fquery/core`: `fam_ref` module graph resolver、cycle停止、extraction candidate判定
- `@fquery/core`: 同じTopology revisionからRunner dependencyとlayout非依存Presentation inputを純粋投影
- `@fquery/core`: objective fact / subjective truth adapter capabilityを分離
- `sample1 / sample2 / sample3`: array parallel、object address、L/mL差、module referenceを回帰test

実GUIへの接続、provider generation前のrefFAM注入、非線形発見evalはそれぞれ後続Issueの責務であり、本receiptから完了へ昇格しない。Human確認手順は[`../testing/issue-43-human-acceptance.ja.md`](../testing/issue-43-human-acceptance.ja.md)とする。
