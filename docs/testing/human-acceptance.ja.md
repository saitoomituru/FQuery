# 人間テスト引継ぎ票

状態: `HUMAN-TEST-WAIT`

自動検証は型、状態軸、イベント配送、fixture描画、buildまでを対象にする。以下は人間が実画面と実Hostで判断するまで完了扱いにしない。

## Vue component

- `unknown`、`bottom`、`last-order`、`plugin-not-found`、`semantic-unsatisfied`が色だけに依存せず識別できる
- `unconnected`がerrorに見えず、`plugin-not-found`と混同しない
- keyboardだけでinspect、preview、execute、cancelへ到達できる
- 長いquery ID、Last Order、evidence参照でも崩れない
- `npm run dev`で`http://127.0.0.1:3000`を開き、hero、route controls、Q nodeが意図した配置で見える
- ProviderをFixture、Gemini、Ollamaへ切り替えると、それぞれ独立したmodel候補が表示される
- 自然言語を分解し、入力言語の再帰的な `ψ / ∇φ / λ / Q`、`Q.unknowns`、provider/model/plugin revisionが読める
- 他言語の写本が正本を置換せず `λ.sub_splitters` にあり、翻訳誤差が`not-evaluated`または測定receiptとして追跡できる
- 旧 `blocks[]` 候補がFAM paneへ表示されない
- Gemini routeでBrowserのNetwork payload／画面／consoleへcredentialの`key / secret`が出ず、表示用`name`だけが見える

## Host

- VS Code Webviewの実APIでeventがextension側へ一度だけ届く
- Sphere Runnerの実portで同じcomponentとprotocol revisionを共有できる
- 不正なruntime messageが画面状態を破壊しない

## 記録

実施時はOS、runtime、Host version、commit、スクリーンショットまたは操作記録、合否、残課題をIssue #5へ記録する。provider交換と自然言語FAM分解はIssue #19にも結果を反映する。
