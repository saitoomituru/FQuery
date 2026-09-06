# @fquery/config

可搬なcredential注入境界。FQueryは鍵管理基盤を所有しない。

credential recordは`name`、`key`、`secret`だけを持つ。env、dotenv、YAML dotfile、明示値、Host callbackを同じ`CredentialSource`として扱い、許可sourceと解決順序は呼出し側が決める。

単体runnerの既定はprocess env、`.env.local`、`.env`。上位システムは自身のIAM sourceを追加または置換できる。暗号化保管、rotation、失効、hash、fingerprintはこのpackageの責務ではない。
