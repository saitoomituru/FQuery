# @fquery/plugin-gemini

Gemini APIをFQueryのFAM変換capabilityへ接続する最初のLLM adapter。

実行には`CredentialSource`、credential name、modelをHostが渡す。単体runnerでは`GEMINI_API_KEY`をenvまたは`.env.local`から解決できる。browserへ鍵を渡さず、FAMLogへはcredential nameだけを記録する。

LLM出力は`candidate FAM`であり、採用FAMや真理ではない。structured-output Schemaは要求したdecomposition等のprofileであり、FAM base構造の全列を定義するものではない。profile不適合、transport失敗、意味評価を混同しない。実API smoke testは自動テストに含めない。
