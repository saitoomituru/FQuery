# FAMLog semantic dump

FAMLogはconversation transcriptではなく、Q/FAMの観測可能なappend-only execution traceである。

## Event taxonomy

`query-received`、`bind`、`unbind`、`plugin-resolve`、`plugin-call-start`、`plugin-call-end`、`projection`、`semantic-check`、`bottom`、`unknown`、`last-order`、`result`を初期eventとする。

各entryは`event_id`、`sequence`、`event_type`、`query_ref`、`observed_at`、`status`、`provenance`を持つ。該当する場合だけplugin、capability、runtime、model、Registry、Fold、OAE、再現条件を追加する。

## 秘密境界

- credential、token、cookie、authorization header、private key、raw secretを保存しない
- input/output payloadはredactor通過後だけ保存する
- hashはbytes同一性の補助であり、真理・完全性・権利の証明ではない
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

差分件数だけを総合品質scoreへ昇格せず、各分類とsource eventを保持する。
