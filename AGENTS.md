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

人間向けREADME、文書、Issue、commit、PR、code comment、CLI help、検証報告は、互換性を壊さない限り日本語を既定とする。identifier、Schema key、package名、protocol symbolは英語を保持する。

## 作業規則

- 現段階では`main`へ小さな意味単位でcommitし、各checkpointを検証してpushする
- 実装、automated test、human test、package、publish、runtime operationを別状態として報告する
- 外部network、model、device、IBDへの副作用は既定denyとし、fixtureと明示adapterを優先する
- secret、credential、private payloadをFAMLog、fixture、commitへ保存しない
- `unknown`、`bottom`、`last-order`を例外一種類へ潰さない
- human visual reviewを自動snapshotで代用しない

## 必読Context

`SPHERE-DOS.md`が固定するSphereOS AtlantisおよびZeroRoomLab-manifestのrevisionを参照する。Context AliasはGit submodule、package dependency、runtime authority、実行receiptではない。
