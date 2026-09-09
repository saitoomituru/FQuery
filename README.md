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
- credential注入: `name / key / secret`の可搬なsource解決あり。保護強度はHost／上位IAM責務
- FAM JSON Core: 再帰的な `ψ / ∇φ / λ / Q`を最小交渉面とし、未知fieldを保持するopen-world machine contractあり。decomposition等の追加field拘束はprofileとして分離中（Issue #22）
- Gemini FAM plugin: structured JSON候補を返すadapterあり。provider応答、base構造適合、profile適合、意味評価は別状態
- Node Editor: Presentation FAM／GUI Event ABI、React + React Flow renderer backend、VS Code／Sphere Host bridgeあり。renderer backendの比較Human Testは通過したが、Browser上の分解・局所編集・λ再投影・nested FoldはChrome／SafariともHuman Test不合格（Issue #35、#38、#41）。Host組み込みは未実施
- Atlantis 1.x native C++ runtime: `CONTRACT-WAIT`

API、tool、pluginの呼び出し成功は、目的 `λ` の達成証拠ではありません。pluginが存在することと、GUI上でportが次nodeへ接続されていることも別状態です。

## FAMの最小交渉面と拡張

FAMはopen-worldです。CoreがFAMとして最低限要求する構造keyは`ψ / ∇φ / λ / Q`だけで、各軸の内容は未記入、`unknown`、またはWorld固有表現を取り得ます。`title`、`kind`、lineage、言語metadata、Access Mapper、OAE、任意の追加fieldは、利用するprofile／plugin／上位Systemとのnegotiationで拘束します。

```text
base_structure       = 4軸構造がFAMとして読めるか
profile_conformance  = 選択profileの追加要求を満たすか
service_negotiation  = plugin／adapter／socketを利用できるか
observer_verdict     = 指定OAE rule下で観測者がどう評価したか
```

これらを一つの`valid / invalid`へ潰しません。知らないfieldや未提供の拡張fieldは、それだけで自然言語やFAM全体を拒否する理由にならず、losslessに保持します。profile未成立は`not-satisfied`または`not-evaluable`として記録し、base構造不正と区別します。

FQueryは自然言語を断罪するvalidatorでも、世界の唯一の正解を決める神託機でもありません。入力は暗黙のWorld常識、関係、個人記憶、業界慣行等を含む不完全な観測として受け取り、どのrefFAM／Access Mapper／観測者／ruleで解釈したかを追跡可能にします。複数解釈や相反するOAEは非ゼロサムで併存でき、採用範囲とauthorityは上位Systemからrevision固定refとして注入されます。

一回の分解で全てを埋め切る義務はありません。初回結果は手直し可能な暫定Foldでよく、`なんで？-DeFold-`による段階的分解、局所差替え、revision、FAMLogを通して回復可能であることを優先します。

## Repository map

| Path | 責務 |
|---|---|
| `proton/` | 言語非依存のFQuery semantic profile |
| `docs/architecture/` | Q Core、再帰、Node→nativeの責務境界 |
| `docs/specification/` | machine contractへ対応する人間可読仕様 |
| `packages/core/` | backend非依存のNode参照Core |
| `packages/fam-core/` | FAM JSONの再帰4軸、open-world reader、lossless保持。追加拘束はprofileとして注入 |
| `packages/fam-edit/` | canonical FAMのlossless部分編集primitive。validatorは注入し、FAM Coreを所有しない |
| `packages/plugin-sdk/` | capability、bind、invoke、result envelope |
| `packages/famlog/` | append-only semantic traceと差分 |
| `packages/benchmark/` | 同一Qの複数plugin／model route比較 |
| `packages/ui-core/` | runtime非依存ViewModel／event contract |
| `packages/ui-react/` | React + React Flow Presentation component。semantic engineは持たない |
| `packages/hosts/` | VS Code／Sphere等のHost bridge |
| `packages/config/` | credential sourceの順序付き解決。表示は`name`のみ |
| `plugins/gemini/` | Gemini APIから検証済みFAMを得るnetwork plugin |
| `plugins/ollama/` | ローカルOllamaのmodel発見と検証済みFAM変換plugin |
| `apps/playground/` | API key不要のlocalhost検証面（React） |
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
npm run dev # http://127.0.0.1:3000
```

PlaygroundはHost gatewayからrouteを発見し、fixture、Gemini、ローカルOllamaを同じ`fam.decompose`契約で切り替えます。Basic Commons Access Mapperはrevision固定のtest fixtureであり、Manifest／IBDの正本や普遍的な分類規則ではありません。期待設計では分解前にactive refFAMとして注入し、同じrevisionを生成・検証・投影へ通しますが、現行経路は未完了でIssue #41を追跡中です。Gemini credentialはHost側だけで解決され、Browserへは表示用`name`しか返しません。

現在の正本参照と実行境界は[`SPHERE-DOS.md`](SPHERE-DOS.md)、repository固有規約は[`AGENTS.md`](AGENTS.md)を参照してください。
画面と実Hostの未検証項目は[`docs/testing/human-acceptance.ja.md`](docs/testing/human-acceptance.ja.md)、Issue #35固有の停止点は[`docs/testing/issue-35-human-acceptance.ja.md`](docs/testing/issue-35-human-acceptance.ja.md)へ分離しています。

## Credits

GUIの概念設計はChatGraph（uynet）とBlenderのnode editorを参考にしています。コード・assetの転用はなく、platformもengineも異なります。詳細は[`CREDITS.md`](CREDITS.md)を参照してください。

## License

code、Schema、fixtureはApache-2.0です。文書の追加license境界は制定時に各ファイルまたは`LICENSE-POLICY.ja.md`で明記します。外部正本はcopyせず、sourceとrevisionを参照します。
