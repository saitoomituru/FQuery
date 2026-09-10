# Sphere-DOS PLI Context Alias

このファイルはFQueryからSphereOS AtlantisとZeroRoomLab-manifestの設計Contextへ到達するためのPrompt Line Interface上のaliasです。

## 固定source

| Source | Revision | Entry |
|---|---|---|
| SphereOS Atlantis | `4de928dec5196d458ace96432b2f9aac9c7cfabc` | `SPHERE-DOS.ja.md` |
| Proton.md Core | 同上 | `docs/architecture/proton-md-executable-context-container.ja.md` |
| FAM Family | 同上 | `proton/modules/FAMFamily.proton.md` |
| ZeroRoomLab-manifest | `7a8618178184b550f2a65a665866f161491577b8` | `docs/theory/fam-module-selector-and-fold-scope.ja.md` / `docs/theory/fam-infoton-reference-boundary.ja.md` / `docs/theory/fam-model-adapter-support-levels.ja.md` |
| ZeroRoomLab-manifest legacy context | `0949625b7472ff815bf1fba4f43c753e85f22eee` | `AGENTS.md` / `docs/theory/sphere-context-dimension-os.ja.md` |
| IBD Query FAM draft | `25861b8970ce932bc99b272a0a813822e4df5cab` | `schemas/draft/query-fam.schema.json` |

## 現行FAM selector / 参照境界

FQueryでFAM module、selector、Fold / refFAM / FAMJSON / FAMLog / OAEの意味境界とmodel adapterの申告Levelを解釈する場合、ZeroRoomLab-manifest `7a86181` の次を優先参照する。

- `fam-module-selector-and-fold-scope.ja.md`
- `fam-infoton-reference-boundary.ja.md`
- `fam-model-adapter-support-levels.ja.md`

要点:

```text
self    = current FAM file / module
this    = current node

L       = prev / next structural traversal
mL      = before / after runtime semantic traversal

FAMJSON = 再参照可能な独立意味identity / Infoton
refFAM  = AQC SchemerをFAM統合した形而上学的method / wisdom
FAMLog  = 時間方向の観測・操作trace
Fold    = independent FAM reference / scope boundary
```

selectorは既定でcurrent Fold scopedとし、意味分類とpointer拘束を混同しない。複数参照されたsubtreeやcurrent Fold内でidentityを保ったlossless normalizationが成立しない可搬単位は、同一FAM JSON内のshared nodeへせず独立FAM extraction candidateとして扱う。factを含むものをrefFAMへ正典化しない。

FQuery側machine contractは次を参照する。

- [`docs/specification/fquery-selector-traversal-normalization.ja.md`](docs/specification/fquery-selector-traversal-normalization.ja.md)
- [`docs/specification/fam-reference-boundary.ja.md`](docs/specification/fam-reference-boundary.ja.md)

## 境界

- Context AliasはGit submoduleでもpackage installでもない
- aliasを読めることはCLI、MAGI、Actions、runtimeを実行した証拠ではない
- FQueryのrepository authorityはFQueryに残る
- sourceを参照できない場合は推測で補完せず`CONTEXT-INCOMPLETE`としてmutation前に停止する
- Proton.md、FAM、Query FAM、Last Orderの意味をFQuery側でsilent rewriteしない
- 別repositoryへ変更を波及させる場合は、そのrepositoryの規約とUser authorityを別に確認する

FQueryはSurface 3の軽量Context Aliasを採用します。実行・validator・cross-repository fixtureが必要な工程では、明示したlocal checkoutまたはCI checkoutを別Execution Envelopeとして使用します。
