# FAMLog semantic dump

FAMLogはconversation transcriptではなく、Q/FAMの観測可能なappend-only execution traceである。

PlaygroundのFold操作は`fold.log/0.1.0-alpha`として残し、各entryから`oae.record/0.1.0-alpha` profileのOAEレコードを生成できる。ただし保存状態は`volatile`であり、IBDのvector graph DB／RDB双方への永続化と取得receiptが実装されるまではOAE管理システムとは呼ばない。OAEレコード生成能力まで「未実装」と矮小化せず、生成・adapter受理・永続化を別statusで表す。

## FAMJSONとの境界

単発の観測・所感・操作traceを書いた時点では、それを自動的にFAMJSON / Infotonへ昇格しない。

```text
OAE / observation
  -> FAMLog
  -> 別Contextから再利用・再参照される
  -> independent semantic identity candidate
  -> FAMJSON / Infoton
```

どこからも意味単位として参照されず、その場の観測として閉じているrecordはFAMLog / OAE candidateである。

一方、ある記録・subtree・Foldが別処理から再参照され、独立identity / revision / Q / provenanceを持つ必要が出た場合、FAMLogはその**情報子への昇格過程**を記録する。

FAMLog自身を共有知識DBへ変換しない。promote / extractionの結果として独立FAMを作り、そのFAMへのrefをeventから辿れるようにする。

refFAMとの境界は[`fam-reference-boundary.ja.md`](fam-reference-boundary.ja.md)を参照する。factを含むrecordをrefFAMへ無断昇格させない。

## Event taxonomy

`query-received`、`bind`、`unbind`、`plugin-resolve`、`plugin-call-start`、`plugin-call-end`、`projection`、`semantic-check`、`bottom`、`unknown`、`last-order`、`result`を初期eventとする。

Fold/FAM参照境界のcorrective profileでは、次のoperation eventを追加候補とする。

```text
fold-extraction-requested
fold-extraction-candidate
fam-created
parent-reference-replaced
fold-extraction-accepted
fold-extraction-rejected
reference-resolved
reference-resolution-failed
artifact-promotion-candidate
artifact-promotion-accepted
artifact-promotion-rejected
```

`artifact-promotion-*`は「価値が高い」「真理になった」を意味しない。FAMLog / OAEとして局所だったrecordが、独立した再参照可能identityを必要としたというlifecycle eventを表す。

各entryは`event_id`、`sequence`、`event_type`、`query_ref`、`observed_at`、`status`、`provenance`を持つ。該当する場合だけplugin、capability、runtime、model、Registry、Fold、OAE、FAM identity、再現条件を追加する。

FAM extraction / promotion eventでは最低限、可能な範囲で次を記録する。

- source parent FAM / revision
- source FAMLog / OAE ref
- selected node / Fold / pointer refs
- created child FAM / revision
- parent reference binding
- active profile / authority ref
- before / after digest
- unknown field retention
- loss status
- initiator / observer / executor

LLM provider呼び出しでは、観測できた`provider`、`model`、`plugin_version`、credentialの表示用`name`、vendorの`request_id`だけを`execution`へ記録できる。credentialの`key`と`secret`は実行時注入に限り、FAMLogへ流さない。

## 秘密境界

- credential、token、cookie、authorization header、private key、raw secretを保存しない
- input/output payloadはredactor通過後だけ保存する
- credential hash／fingerprint設計はFQuery 0.1の責務外とし、EDOHAGE側の次期契約へ委ねる
- vendor添付用repro bundleは最小fixture、version、status差分、再現手順だけを含める

## 高濃度repro bundle

vendorやruntime実装者へ渡すbundleは、次の最小構成とする。

- 入力Query fixtureとsemantic contract version
- runtime、plugin、modelのrevision（観測できた範囲だけ）
- secret除去済みFAMLogと比較対象への参照
- 直交状態軸ごとの差分と該当event sequence
- 再現command、実行環境、期待結果、実結果
- 取得不能項目を不存在へ変換しない`UNKNOWN`欄

会話全文、credential、無関係な利用者データを「念のため」で同梱しない。

## Benchmark分類

- `port-hallucination`
- `unsupported-success-claim`
- `no-bottom-return`
- `lambda-blur`
- `plugin-resolution-failure`
- `cross-runtime-divergence`
- `inline-shared-node-collapse`
- `reference-boundary-loss`
- `artifact-role-overpromotion`

差分件数だけを総合品質scoreへ昇格せず、各分類とsource eventを保持する。
