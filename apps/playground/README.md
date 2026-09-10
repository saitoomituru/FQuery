# @fquery/playground

API key不要のlocalhost検証面。`@fquery/ui-react`（React + React Flow）をPresentation surfaceとし、engineはfixture decision portとgatewayで代替する。

```bash
npm run dev      # http://127.0.0.1:3000
```

## 構成

- `App.tsx`: composition root。session購読とUI局所状態だけを持つ
- `host/session.ts`: session構築、`fam.patch`／`fam.text`のCore fam-edit適用、edit receipt store
- `host/pane-registry.ts`: pane contribution宣言とcomponentRef map
- `host/core-graph.ts`: Core 3 nodeの構築と新規nodeの配置（layout write-back）
- `host/decomposer.ts`: gateway経由の分解と、Ψ.NL／∇φ.FAMVIM／λ.NLへの投影
- `panes/sections.tsx`: 1 section 1 component。Host contextからGUI Core componentへ橋渡し
- `nodes/`: Core 3 nodeのcanvas renderer（`rendererHint: fquery-core-node`）
- `server/gateway.ts`: `/api/routes`と`/api/decompose`。provider routeの発見とQ envelope
- `server/cli-executor.ts`: Host許可registryの完全一致`commandRef`だけを`shell:false`で起動するCLI harness executor。stdin/stdout/exitとredaction済みstderr状態をLv1 receiptへ渡す。BrowserやFAMからbinary path、args、cwd、envは指定できない

## 機能

- 全画面canvas、Core 3 node、node本体のplugin renderer
- drag→`node.move.requested`、接続→`connection.add.requested`、選択→`node.select.requested`。GUIはModelを書かない
- 左Tool pane（Add Node／階層／Records／Decisions）、右Inspector pane（Node／Q／Unsupported Data／RAW FAM）
- Node Panel 5 tab、FAMVIM RAW編集、Unsupported→RAWのjump
- `T`／`N`／`Home` key、pane開閉・tab・折り畳みのlocalStorage便宜状態

human test項目は`docs/testing/human-acceptance.ja.md`を参照する。React Flow renderer比較のHuman Test通過は、decomposition／局所編集／λ再投影／nested Foldの合格を意味しない。Chrome／Safariの現在の不合格と停止点は`docs/testing/issue-35-human-acceptance.ja.md`およびIssue #35／#38／#41で追跡する。
