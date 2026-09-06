# @fquery/plugin-gemini

Gemini APIをFQueryのFAM変換capabilityへ接続する最初のLLM adapter。

実行には`CredentialSource`、credential name、modelをHostが渡す。単体runnerでは`GEMINI_API_KEY`をenvまたは`.env.local`から解決できる。browserへ鍵を渡さず、FAMLogへはcredential nameだけを記録する。

LLM出力は`candidate FAM`であり、採用FAMや真理ではない。実API smoke testは自動テストに含めない。
