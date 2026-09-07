# local sin／parent SIN伝播契約 0.1.0-draft

状態: `[EXPERIMENTAL CONTRACT]` `[DETERMINISTIC HARNESS IMPLEMENTED]` `[CANONICAL FORMULA UNKNOWN]`

local `sin`は、特定metric／scaleで観測されたnodeの局所乖離である。原典の`SIN_Temperature`が表す指定・許容創造度とは別field・別receiptとして扱う。

- `Math.sin`、角度、周期、sector境界をCore既定値にしない
- vector storeのraw scoreにはstore固有`calibrationRef`を要求する
- `metricRef`と`scaleRef`が違う値を無断比較しない
- 未測定値を0へ変換しない
- 大きな乖離はcreative transferやcounter-vector候補でもあり、自動failureにしない
- `stop-candidate`はreview候補であり、自動停止命令ではない

`propagateLocalSin`は測定済み値へ明示gainを適用し、呼出側が注入したaggregation profileへ渡す。receiptは各contribution、未解決measurement、aggregate metricを保持する。数学的rank、sector、failure閾値の制定は別のUser Gateに残る。
