# AGENTS.md — FQuery

このrepositoryを編集するagentは、最初に[`SPHERE-DOS.md`](SPHERE-DOS.md)を読む。

## Repository authority

- FQueryの短縮名とoperatorは`Q`。FAMの`Q`との記号同一性は意図的であり、「紛らわしい」という理由でrenameしない
- FQuery repositoryの正本責務をSphereOS Atlantis、IBD、Node.js、Vue、C++へ移譲しない
- Proton.md、FAM、Query FAM、FAMLog、Last Orderの外部正本をsilent rewriteしない
- Node参照実装やnative C++実装をsemantic ABI正本に昇格しない
- GUI変更からruntime contract変更を暗黙導出しない

## 状態境界

```text
API success != Q success
plugin exists != port connected
unconnected != failure
transport success != lambda satisfied
unknown != pass
```

## FAM open-world契約

- FAMのbase構造で必須とするkeyは`ψ / ∇φ / λ / Q`だけとする。各軸は未記入、`unknown`、World固有値を取り得る
- `title`、`kind`、index、lineage、言語metadata、Access Mapper、OAE等をbase必須列へ暗黙昇格しない。必要な拘束はrevision固定profileとして注入する
- 未知field、規定外field、新しいservice fieldを「Schemaにない」だけでreject・削除・renameしない。losslessに保持する
- `base_structure`、`profile_conformance`、`service_negotiation`、`observer_verdict`を別軸で報告する。profile不適合をFAM全体の不正へ書き換えない
- 自然言語の不完全さ、混在言語、code、俗語、暗黙Contextを規約違反として断罪しない。自然言語は解釈対象であり、validatorは文章の善悪・真偽・正しさを裁定しない

## FAMJSON / FAMLog / refFAM境界

- FAMJSONを「4軸を持つJSONなら何でもそう呼ぶ」状態へ縮退させない。FAMJSONは再参照可能な独立意味identity＝情報子のwire representationとして扱う
- 単発の観測、所感、操作trace、0参照のrecordは、まずOAE / FAMLog candidateとして扱う。再参照可能なidentityを持った時点でFAMJSONへの昇格候補になる
- refFAMは共有fact tableではない。旧AQC SchemerのFAM統合版であり、問い方、見方、分類、成立条件、mapping、検証法、unknown policy等の形而上学的method / wisdomを記述する
- fact、業務上の事実、特定Worldのstate、合意logを含む場合は通常FAMとして分離する。必要なprofileがQへevidence、observer、subject revision、取得方法、verifier、hash receipt等を要求する
- `複数参照された == 真理`、`複数参照された == refFAM`と短絡しない。複数参照はまず経験価値の可搬性、独立情報子へ昇格すべきsignalとして扱う
- 正本思想はZeroRoomLab-manifest `fam-infoton-reference-boundary.ja.md`、FQuery machine contractは[`docs/specification/fam-reference-boundary.ja.md`](docs/specification/fam-reference-boundary.ja.md)を参照する

## Fold参照正規化

- 同一FAM内の`∇φ` / subtree / Fold nodeを複数semantic consumerからshared nodeとして直接参照しない。複数参照が必要になった時点で独立FAM extraction candidateとする
- Fold boundaryは原則として独立FAM identityへの参照境界である。Fold内部をparent FAMのcanonical hidden child arrayとして所有し続ける設計へ新規依存を増やさない
- `まとめる-Fold-`は参照先FAMを削除せずpresentationだけを縮約する
- `ひらく-DeFold-` / `なんで？-DeFold-`は参照先FAMをresolveしてprojectする。child FAMをparent FAM JSONへinline copyしない
- `unFold`だけが独立FAM境界や中間表現を破壊し得る。Fold / DeFoldを暗黙にunFoldへ昇格しない
- React Flowの一枚graph、nested node object、renderer groupをcanonical cross-FAM identityにしない。GUIは複数FAM viewを合成表示するsurfaceである
- legacy nested subtreeを移行する場合、source revision、extracted FAM identity、node refs、unknown fields、before/after hash、loss statusをreceipt化し、内容を失わない

## 解釈・OAE・authority境界

- Coreは唯一のWorld、正解、客観、合意、authorityをhard-codeしない。active refFAM／Access Mapper／`oae_rule_ref`を上位Systemからrevision固定で受け取る
- `capability != authority`、`observation != authority`、`consensus != authority`を維持する。authorityは対象、操作、World、revision、期間を持つscope付き運用契約として扱う
- 複数の解釈、複数の合意、相反するObserver verdictを非ゼロサムで保持する。一つのscopeで採用された解釈から他branchの削除を導出しない
- 「客観的」は無主体の普遍真理へ昇格せず、合意したcorpus、Observer、instrument、rule、適用scopeを提示する。個人と手元instrumentの合意も`locally-verified`として保持できるが、独立検証済みとは名乗らない
- FQueryが検証するのはOAE recordのshape、lineage、revision binding、rule conformanceであり、verdictの宇宙的真偽ではない。`適切`、`度し難い`等の評価語彙も外部ruleが所有する

## 手直し可能性と段階的DeFold

- 一回で完全・網羅・唯一の分解を要求しない。空欄や`unknown`を許し、初回Foldを暫定の最尤候補として扱う
- 手直し不能な「正解」より、局所編集、branch、revision、差分、Observer／rule付きreceiptから回復できる候補を優先する
- `なんで？-DeFold-`は必要箇所を段階的に掘り、実際に使った解決元を示す。receiptが無い場合はもっともらしい説明を生成せず`resolution-provenance-unavailable`を返す
- L/mL/G/Dを一括fan-outへ潰さない。Lはtool／API／adapter chain、mLは判断・解釈chain、GはFold-on-Fold深度、Dは独立Context次元として保持する
- 実行並列性やrenderer都合をcanonical semantic topologyへ逆流させない

人間向けREADME、文書、Issue、commit、PR、code comment、CLI help、検証報告は、互換性を壊さない限り日本語を既定とする。identifier、Schema key、package名、protocol symbolは英語を保持する。

## 作業規則

- 現段階では`main`へ小さな意味単位でcommitし、各checkpointを検証してpushする
- 実装、automated test、human test、package、publish、runtime operationを別状態として報告する
- 外部network、model、device、IBDへの副作用は既定denyとし、fixtureと明示adapterを優先する
- secret、credential、private payloadをFAMLog、fixture、commitへ保存しない
- `unknown`、`bottom`、`last-order`を例外一種類へ潰さない
- human visual reviewを自動snapshotで代用しない
- Issue数、field充足数、node数、分解の細かさを成果指標にしない。回復可能性、provenance、局所修正、停止の誠実さを優先する

## 必読Context

`SPHERE-DOS.md`が固定するSphereOS AtlantisおよびZeroRoomLab-manifestのrevisionを参照する。Context AliasはGit submodule、package dependency、runtime authority、実行receiptではない。
