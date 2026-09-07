# @fquery/playground-react

Issue #36の検討用。`@fquery/ui-react`（React + React Flow）をVue版Playgroundと触り比べるための最小Playground。

```bash
npm run dev:react      # http://127.0.0.1:3001
npm run dev            # Vue版 http://127.0.0.1:3000（同時起動可）
```

gatewayはVue版と同じ`apps/playground/server/gateway.ts`を使う。比較対象はcanvasであり、engine経路を二重化しない。

## 移植済み

- 全画面canvas、Core 3 node、node本体のplugin renderer（Ψ.NL／∇φ.FAMVIM／λ.NL）
- drag→`node.move.requested`、接続→`connection.add.requested`、選択→`node.select.requested`
- Add Node、Decisions receipt、Frame all
- Ψ.NLからgateway経由の分解実行と、∇φ.FAMVIM／λ.NLへの投影

## 未移植（Phase 2）

- 左Tool pane／右Inspector paneのslot式framework、Outliner、category tree
- Node Panel 5 tab、FAMVIM RAW編集、fam.patch経路、Records
- `T`／`N`／`Home` key、localStorageの便宜状態

## human test観点（Vue版との比較）

- nodeをdragしたときに接続線が追従するか。FQuery側にDOM測定codeが無い状態で成立しているか
- 逆向き接続や二重接続がrejectedになったあと、nodeとportが消えないか
- node本体のtextarea／selectを操作してもnodeがdragされず、canvasがzoomしないか
- Frame allでgraph全体が収まるか
