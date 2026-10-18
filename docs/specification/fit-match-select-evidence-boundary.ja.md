# FQuery: 一致操作抽象とEvidence Typeの境界

状態：`DESIGN-CORRECTIVE / IMPLEMENTATION-PENDING`

理論正本：[Manifest / Weaver A-B-CとOAE](https://github.com/saitoomituru/ZeroRoomLab-manifest/blob/main/docs/theory/weaver-abc-evidence-scope-and-oae.ja.md)
IBD設計：[IBD / Evidence Model Drivers](https://github.com/saitoomituru/IBD/blob/main/docs/architecture/evidence-model-drivers-weaver-abc.ja.md)

## 1. 共通抽象 ≠ 同一実装
`Fit / Match / Select`はいずれも**抽象データモデル上の一致操作**。IBDのModel Driverとファイル検索Pluginは同一抽象を使い得るが、実装・入力媒体・比較アルゴリズム・結果型は異なる。

具体例：既存の `Q(self).file.fit(pattern)` はファイル取得Pluginのmethod名として仕様記載がある。これはIBDのWeaver C/FIT graph driver実装が完了したことを意味しないし、`file.fit`をFIT driverと無関係な単語として断絶させてもいけない。意味操作の抽象的な対応は可能だが、**両者のbindingは明示的なprofile/plugin capability contractで決める**。

## 2. モデル差とエビデンス
| 操作/領域（学派モデル） | データ表現 | 保存すべき結果 |
|---|---|---|
| SELECT / Weaver A | 離散・SQL述語による照合 | sourceに拘束されたFact |
| MATCH / Weaver B | 背景を固定したFold・ベクトル近傍 | contextual Evidence（OAE評価対象） |
| FIT / Weaver C | graphのトポロジカル・構造関係 | structural Evidence（OAE評価対象） |

SELECTのFactを普遍構造へ、FITの構造一致を原典Factへ変換しない。SELECTの不一致をFIT falseにしない。Evidence typeとconfidenceとOAE verdictは別軸。

## 3. OAEとFAMLog
OAEは「どのWorld、出典、対象、Observer、rule、関係射影を評価したか」の範囲を管理する資源。FQuery Coreは評価の真偽を自称せず、結果・参照・provenanceを保持する。Driverのreceiptが `not-evaluated` ならfalseへ変換しない。実際のreceipt型は既存plugin-sdk/IBDに照合してから決め、ここでは架空の稼働Schemaを宣言しない。

## 4. 回帰Fixture候補
- 二文化の出典SELECTは別、目的/手段graph FITは限定射影で対応し得る。
- FIT支持から「本末転倒は福音書」とSELECT factを偽造することを拒否。
- SELECT原典不一致からFIT falseを生成することを拒否。
- 水温一点2℃のSELECT記録から河川全域2℃/普遍Δφを生成することを拒否。
- OAE未評価のまま`false`へ縮約しない。
- `file.fit`とIBD FITの具体実装は別でも共通抽象モデルで説明できる。

実装前ゲート：現存するQ/Plugin ABI・IBD contract・OAE receiptとの適合性検証。これは文書追加であって機能実装ではない。
