# Directory layout

| Directory | 一文責務 |
|---|---|
| `proton/` | 実装言語から独立したFQuery profile |
| `packages/core/` | FAM backendを知らない参照Core |
| `packages/plugin-sdk/` | plugin capabilityと実行envelope |
| `packages/famlog/` | 観測eventと差分 |
| `packages/ui-core/` | Presentation共通ViewModel |
| `packages/ui-vue/` | Vue component |
| `packages/hosts/` | Host固有transport adapter |
| `plugins/experimental/` | 正本へ昇格していない実験plugin |
| `fixtures/` | implementation間で共有する正例・負例・benchmark |
| `native/` | Atlantis 1.x世代の将来Vessel |

依存方向はUI/Host→Core contract、plugin→Plugin SDK、Core→FAMLog portとする。CoreからVue、Host、実pluginへ依存しない。
