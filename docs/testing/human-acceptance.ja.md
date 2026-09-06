# 人間テスト引継ぎ票

状態: `HUMAN-TEST-WAIT`

自動検証は型、状態軸、イベント配送、fixture描画、buildまでを対象にする。以下は人間が実画面と実Hostで判断するまで完了扱いにしない。

## Vue component

- `unknown`、`bottom`、`last-order`、`plugin-not-found`、`semantic-unsatisfied`が色だけに依存せず識別できる
- `unconnected`がerrorに見えず、`plugin-not-found`と混同しない
- keyboardだけでinspect、preview、execute、cancelへ到達できる
- 長いquery ID、Last Order、evidence参照でも崩れない

## Host

- VS Code Webviewの実APIでeventがextension側へ一度だけ届く
- Sphere Runnerの実portで同じcomponentとprotocol revisionを共有できる
- 不正なruntime messageが画面状態を破壊しない

## 記録

実施時はOS、runtime、Host version、commit、スクリーンショットまたは操作記録、合否、残課題をIssue #5へ記録する。
