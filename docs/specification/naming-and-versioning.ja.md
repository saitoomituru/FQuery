# Naming / language / versioning

| 対象 | 値 | 責務 |
|---|---|---|
| Product／repository | `FQuery` | 公開名称 |
| Short name／operator | `Q` | 再帰Query operator |
| FAM field | `Q` | Observer／Registry／停止等の検証Context |
| package scope | `@fquery/*` | Node参照実装のpackage識別 |
| semantic contract | `fquery/0.1.0-draft` | 実装言語非依存の意味契約 |
| plugin profile | `fquery.plugin/0.1.0-draft` | capability／invoke envelope |

FAM fieldとoperatorの`Q`はintentional symbol identityであり、偶然の衝突ではない。Node package SemVer、Proton.md Core、FAM profile、Atlantis座標を同じversionへ束ねない。

人間向け正本は日本語を基本にし、machine identifier、Schema key、package、code symbol、protocol fieldは英語を保持する。

言語非依存のJSON wire contractは`snake_case`、TypeScript内部APIは`camelCase`とする。`parseQuery`と`toWireQueryResult`が明示変換境界を所有し、どちらかをsilent rewriteして同一表現とみなさない。
