# Sphere-DOS PLI Context Alias

このファイルはFQueryからSphereOS AtlantisとZeroRoomLab-manifestの設計Contextへ到達するためのPrompt Line Interface上のaliasです。

## 固定source

| Source | Revision | Entry |
|---|---|---|
| SphereOS Atlantis | `4de928dec5196d458ace96432b2f9aac9c7cfabc` | `SPHERE-DOS.ja.md` |
| Proton.md Core | 同上 | `docs/architecture/proton-md-executable-context-container.ja.md` |
| FAM Family | 同上 | `proton/modules/FAMFamily.proton.md` |
| ZeroRoomLab-manifest | `0949625b7472ff815bf1fba4f43c753e85f22eee` | `AGENTS.md` |
| IBD Query FAM draft | `25861b8970ce932bc99b272a0a813822e4df5cab` | `schemas/draft/query-fam.schema.json` |

## 境界

- Context AliasはGit submoduleでもpackage installでもない
- aliasを読めることはCLI、MAGI、Actions、runtimeを実行した証拠ではない
- FQueryのrepository authorityはFQueryに残る
- sourceを参照できない場合は推測で補完せず`CONTEXT-INCOMPLETE`としてmutation前に停止する
- Proton.md、FAM、Query FAM、Last Orderの意味をFQuery側でsilent rewriteしない
- 別repositoryへ変更を波及させる場合は、そのrepositoryの規約とUser authorityを別に確認する

FQueryはSurface 3の軽量Context Aliasを採用します。実行・validator・cross-repository fixtureが必要な工程では、明示したlocal checkoutまたはCI checkoutを別Execution Envelopeとして使用します。
