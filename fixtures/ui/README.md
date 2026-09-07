# UI fixture

runtimeやHostを起動せず、公開`NodeViewModel`だけでVue componentを描画するためのfixture。
画面品質の人間確認を完了した証拠ではない。

`core-nodes.json`はIssue #25のCore 3 node契約（`Ψ.NL` / `∇φ.FAMVIM` / `λ.NL`）の期待graphを記述する。`@fquery/ui-core`の`CORE_NODE_CONTRACTS`と一致することをtestで検証する。
