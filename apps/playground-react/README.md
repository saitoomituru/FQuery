# @fquery/playground-react

Issue #36の検討用。`@fquery/ui-react`（React + React Flow）をVue版Playgroundと触り比べるための最小Playground。

```bash
npm run dev:react      # http://127.0.0.1:3001
npm run dev            # Vue版 http://127.0.0.1:3000（同時起動可）
```

gatewayはVue版と同じ`apps/playground/server/gateway.ts`を使う。比較対象はcanvasであり、engine経路を二重化しない。

## 移植済み（Vue版と同等）

- 全画面canvas、Core 3 node、node本体のplugin renderer（Ψ.NL／∇φ.FAMVIM／λ.NL）
- drag→`node.move.requested`、接続→`connection.add.requested`、選択→`node.select.requested`
- 左Tool pane（Add Node category tree／階層 Outliner／Records／Decisions）、右Inspector pane（Node／Q／Unsupported Data／RAW FAM）のslot式contribution
- Node Panel 5 tab、FAMVIM RAW編集、`fam.patch`／`fam.text`のCore fam-edit適用とreceipt
- Ψ.NLからgateway経由の分解実行と、∇φ.FAMVIM／λ.NLへの投影
- `T`／`N`／`Home` key、pane開閉・tab・折り畳みのlocalStorage便宜状態、Unsupported→RAWのjump

## 構成

- `App.tsx`: composition root。session購読とUI局所状態だけを持つ
- `host/session.ts`: session構築、fam.patch適用、edit receipt store
- `host/pane-registry.ts`: pane contribution宣言とcomponentRef map
- `panes/sections.tsx`: 1 section 1 component。Host contextからGUI Core componentへ橋渡し
- `nodes/`: Core 3 nodeのcanvas renderer

## human test観点（Vue版との比較）

- nodeをdragしたときに接続線が追従するか。FQuery側にDOM測定codeが無い状態で成立しているか
- 逆向き接続や二重接続がrejectedになったあと、nodeとportが消えないか
- node本体のtextarea／selectを操作してもnodeがdragされず、canvasがzoomしないか
- Frame allでgraph全体が収まるか
