# ψ interface observability profile 0.1.0-draft

状態: `[EXPERIMENTAL OBSERVATION PROFILE]` `[HARNESS IMPLEMENTED]` `[CANONICAL RANK UNKNOWN]`

同じFAMへ異なるψ interface／probeを与えたときの応答を、`zero`、`trivial`、`nontrivial`、`unresolved`として記録する。文字数、embedding dimension、文体の複雑さを叡智次元へ自動変換しない。

実装済みharnessは次を集計する。

- `psiInterfaceCount`
- `zeroResponseCount`／`zeroResponseRatio`
- `trivialResponseCount`
- distinct routeに基づく`nontrivialRouteCount`
- `unresolvedCount`
- `transferSurvivalCount`

effective rankを記録する場合、呼出側の推定器が`metricRef`と`scaleRef`を返す。one-liner分類もRegistry固有classifierへ委譲する。reportの`truthValue`は常に`not-asserted`であり、rankやroute数を真理値、普遍品質、人物評価へ昇格しない。
