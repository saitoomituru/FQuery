# Issue #43 Selector / Topology Normalizer Human Acceptance

状態: `CORE-IMPLEMENTATION-CANDIDATE / HUMAN-TEST-PENDING`

## 境界

このHuman TestはCoreのpointer、scope、Topology IR、projection境界を確認する。意味分類の正しさ、live providerの非線形発見、GUIの見た目・操作感、IBD永続化を合格へ含めない。

```text
Core Human PASS
!= GUI Human PASS
!= provider semantic PASS
!= global truth
```

## 対象revision

実施時に次を記録する。

- FQuery commit SHA
- Node.js / npm version
- OS
- Observer名またはref
- 実施日時

## 実行

repository rootで実行する。

```console
npm ci
npm run inspect:topology
npm run test -w @fquery/core
npm run test -w @fquery/fam-core
```

`inspect:topology`のJSONは`observation_only: true`、`human_verdict: pending`を返す。command自身がHuman verdictを捏造しない。

## Human確認項目

### sample1

- `node_count`がrootを含む4
- 3 unitが一つの`parallel_collections`を共有
- `structural_edges`と`runtime_edges`が空
- 3 unitの`runner_dependencies.depends_on`が全て空

### sample2

- `addressable_units`が`fact / anxiety / umbrella`
- runtimeが`fact -> anxiety -> umbrella`
- layer pointerとして`アストラル / エレメンタル`が残る
- structural edgeは空
- Runner dependencyが同じruntime routeを使う
- `presentation_source_topology_ref`と`runner_source_topology_ref`が一致

### sample3

- L structuralが`開発部 -> 製造`
- mL runtimeが`製造 -> 法務部 -> QA -> 開発部`
- `./sample3-2.fam.json`がmodule referenceとして残る
- module graphは親／製造を別`module_ref / fold_ref`で保持
- `inline_expansion`が`false`

### adapter capability

- objective factが`fact-retrieval / verifiable-provenance`を要求
- subjective truthが`semantic-retrieval / interpretation-candidates`を要求
- どちらも`retrievalStatus=not-started`、`adoptionStatus=not-evaluated`

## verdict

次の形でIssue #43へ返す。

```text
Observer:
FQuery commit:
Environment:
Verdict: PASS | FAIL | HOLD

self != this:
array parallel / mL非生成:
object address / before-after:
L != mL:
Fold-scoped / fam_ref no-inline:
Runner / Presentation same topology revision:
objective / subjective capability:

Finding:
Evidence / output ref:
Last Order:
```

`PASS`前はIssue #43をcloseせず、Core実装完了を名乗らない。`FAIL / HOLD`では観測したpointer、期待、実値、再現commandを残す。
