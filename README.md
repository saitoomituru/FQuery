# FQuery

![FQueryのキービジュアル。空中都市を背景に、Q/FAMのnode graphと二人の案内役が再帰Queryの世界を示す](docs/img/hero.png)

FQuery（短縮名 `Q`）は、FAMを問い合わせ、結び、検証し、別のFAMまたは観測可能な停止結果へ写像するための再帰的Query Driverです。

`Q(...)`から別の`Q(...)`を呼び出せます。FAMの`Q` fieldと同じ記号を使うのは意図的であり、制御信号と再帰問い合わせを同じ意味系で扱います。

```text
Proton.md       semantic / meta ABI
FAM             state / wisdom structure
FQuery (Q)      recursive control / query operator
FAMLog          observable execution dump / trace
```

## 現在地

- semantic contract: `fquery/0.1.0-draft`
- Node.js / TypeScript: reference implementationと自動テストあり
- plugin ABI / FAMLog: capability gate、trace、差分の参照実装あり
- Vue Node Viewer: mock-first componentとVS Code／Sphere Host bridgeあり（人間テスト待ち）
- Atlantis 1.x native C++ runtime: `CONTRACT-WAIT`

API、tool、pluginの呼び出し成功は、目的 `λ` の達成証拠ではありません。pluginが存在することと、GUI上でportが次nodeへ接続されていることも別状態です。

## Repository map

| Path | 責務 |
|---|---|
| `proton/` | 言語非依存のFQuery semantic profile |
| `docs/architecture/` | Q Core、再帰、Node→nativeの責務境界 |
| `docs/specification/` | machine contractへ対応する人間可読仕様 |
| `packages/core/` | backend非依存のNode参照Core |
| `packages/plugin-sdk/` | capability、bind、invoke、result envelope |
| `packages/famlog/` | append-only semantic traceと差分 |
| `packages/ui-core/` | runtime非依存ViewModel／event contract |
| `packages/ui-vue/` | Vue 3 Presentation component |
| `packages/hosts/` | VS Code／Sphere等のHost bridge |
| `fixtures/` | 正例、負例、benchmark入力 |
| `native/` | Atlantis 1.x向け予約地。現時点ではruntimeではない |

## 開発

Node.js `22`または`24`とnpm `10`以上を対象にします。

```console
npm install
npm run validate:fixtures
npm test
npm run typecheck
npm run build
```

現在の正本参照と実行境界は[`SPHERE-DOS.md`](SPHERE-DOS.md)、repository固有規約は[`AGENTS.md`](AGENTS.md)を参照してください。
画面と実Hostの未検証項目は[`docs/testing/human-acceptance.ja.md`](docs/testing/human-acceptance.ja.md)へ分離しています。

## License

code、Schema、fixtureはApache-2.0です。文書の追加license境界は制定時に各ファイルまたは`LICENSE-POLICY.ja.md`で明記します。外部正本はcopyせず、sourceとrevisionを参照します。
