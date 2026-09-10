# Browser自動検証とHuman Testの運用境界

更新日: 2026-09-11

この文書はFQuery Playgroundのbrowser確認を再現するための手順である。自動検証、実browser engineの自動操作、人間による目視・操作、live provider確認を一つの`PASS`へ潰さない。

## 状態の分離

| 状態 | 実行面 | 証明できる範囲 | 証明しない範囲 |
|---|---|---|---|
| `CHROMIUM-CI-PASS` | GitHub ActionsのPlaywright管理Chromium | clean install、fixture GUI経路、HTTP／DOM契約 | Mac実Chrome、Safari、Human UX、live provider |
| `CHROME-AUTOMATED-PASS` | Macへinstall済みのGoogle ChromeをPlaywrightが操作 | 実Chrome binaryで同じfixture経路が動く | 人間の操作感・可読性判断 |
| `SAFARI-MCP-AUTOMATED-PASS` | Safari Remote Automation + Safari MCP | SafariのDOM、Network、Console、screenshot観測 | User Human Test、live provider成功 |
| `HUMAN-TEST-*` | Userが実Safari／実Chromeを操作 | 指定手順に対する配置、可読性、drag、操作感のObserver verdict | global truth、別revision、別World |
| `PROVIDER-RECHECK-*` | Gemini／Ollama等の明示route | provider／model／credential／transportの当該実行receipt | λ成立、別provider、将来実行 |

HTTP 200、`transport_status=succeeded`、`plugin_status=resolved`は`semantic_status`または`lambda_status`の成立を意味しない。fixtureの現行wire resultはsemantic／lambdaを`not-evaluated`とし、GUIのλ badgeは判定していないため`unknown`を保持する。

## 共通準備

対象はFQuery repository rootとする。

```console
npm ci
npm run verify:origins
npm run validate:fixtures
```

固定Manifest／SphereOS-Atlantis／IBD参照とauthorityは[`../../SPHERE-DOS.md`](../../SPHERE-DOS.md)を正本とする。browser testのために他repositoryを変更しない。

## CI managed Chromium

`.github/workflows/verify.yml`の`Browser fixture (Chromium)` jobが次を実行する。

```console
npm ci
npx playwright install --with-deps chromium
npm run test:browser
```

失敗時だけ`test-results/playwright`のtrace／screenshotを7日間artifactへ保存する。成功時にartifact保存stepがskipされるのは正常である。

## Macの実Chrome自動検証

既にinstall済みのGoogle Chrome stable channelをheadless操作する。

```console
npm run test:browser:chrome
```

人間がautomation windowを追う必要がある場合だけheaded modeを使う。

```console
npm run test:browser:chrome:headed
```

テスト用Viteは`127.0.0.1:3100`を使用し、通常開発用`3000`を再利用しない。起動processへ`GEMINI_API_KEY`の空値を明示して、fixture E2EからGemini生成要求を発生させない。

## ローカルmanaged Chromiumが必要な場合だけ

実Chrome stableが無いmachine、またはCIと同じbrowser revisionをローカル再現する場合だけ導入する。既存Chromeで`test:browser:chrome`が通るmachineでは必須ではない。

```console
npx playwright install --dry-run chromium
npx playwright install chromium
npm run test:browser
```

最初のcommandでversion、download URL、cache先をHuman確認してから導入する。browser cacheはrepositoryへcommitしない。

## Safari Remote Automation

### Userだけが実行するone-time設定

管理者passwordとSafari GUI操作が必要なので、Codexが無断で代行しない。

```console
safaridriver --enable
```

Safariの「設定」→「デベロッパ」で`Allow Remote Automation`を有効にする。日本語UIでは「リモートオートメーションを許可」等の表示になる場合がある。

FQueryのlocalhost確認だけなら、次の設定は有効化しない。

- スマート検索フィールドからのJavaScript
- Apple EventからのJavaScript
- ローカルファイル制限の無効化
- クロスオリジン制限の無効化

### Codex MCP登録

公式OpenAI Docsの`codex mcp`手順どおり、stdio serverはcommandとargsを`--`以降へ渡す。既に`codex mcp list`で`safari`が`enabled`なら再登録しない。

```console
codex mcp get safari --json
codex mcp list
```

未登録machineでserver自体のbuildとHuman reviewが済んでいる場合だけ、絶対pathを置き換えて登録する。

```console
codex mcp add safari -- node /absolute/path/to/safari-mcp-server/build/index.js
codex mcp get safari --json
```

登録後は新しいCodex sessionでSafari toolsが露出することを確認する。Codex設定の正本はuser-level `~/.codex/config.toml`であり、FQuery repositoryへmachine固有pathを書き込まない。

[OpenAI Docs: `codex mcp`](https://learn.chatgpt.com/docs/developer-commands#codex-mcp)

### Safari MCP自動観測

1. `http://127.0.0.1:3000`の所有processとrepositoryを確認する。
2. Safari automation sessionを開始し、対象URLへnavigateする。
3. fixtureだけを選び、Network／Consoleをclearしてから分解する。
4. POST URL、HTTP status、request body、query ref、wire状態軸、active refFAM revisionを記録する。
5. DOMのFold数、λ投影、runtime error、alert、Consoleを記録する。
6. 狭幅では`全体表示`後に全nodeがviewportへ収まるか観測する。
7. screenshotは自動観測receiptでありHuman verdictではないと明記する。
8. sessionをcloseする。

Safari automationの同時session可否を事前に仮定しない。既存automation sessionを先に一覧化し、Userの通常windowや別testを勝手に終了しない。

## stale dev serverの識別

`3000`が使用中でも、いきなりprocessを終了しない。まず対象を同定する。

```console
lsof -nP -iTCP:3000 -sTCP:LISTEN
ps -p PID -o pid,lstart,command
lsof -a -p PID -d cwd -Fn
curl -I http://127.0.0.1:3000/
```

同じFQuery repositoryの意図したVite processなら再利用できる。別repository、別User、目的不明、またはstaleか判定できない場合は`UNKNOWN`としてUserへ返す。PID等の対象確認なしに`killall node`を実行しない。

## User Human Test

自動観測が緑になった後も、Userは[`issue-35-human-acceptance.ja.md`](issue-35-human-acceptance.ja.md)の手順を実Safariと実Chromeで行う。最低限、次をHuman verdictとして返す。

- 実施browserとversion
- FQuery commit SHA
- fixture／provider、model、入力sourceの参照
- 初期表示、3 Fold、λ 3行、全体表示、pane、drag、局所差替え、FoldLogの観測
- `matched`／`not-matched`と、判断したObserver／rule／scope
- 失敗時の画面、Network、Console、Last Order

Human Testが不合格でも自動testの成功は取り消さず、別axisとして併記する。逆にHuman Test合格もCI、provider、credential、IBD永続化の完了へ昇格させない。
