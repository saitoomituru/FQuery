# @fquery/ui-react

React + React Flowをgraph presentation surfaceとして使うrenderer backend（Issue #36で採用）。

## 責務境界

```text
FAM / canonical engine state（session側）
        ↓ 一方向投影
@fquery/ui-core   PresentationFam / NodeViewModel / ConnectionViewModel / GuiEventAbi
        ↓
@fquery/ui-react  src/model/  … DOM非依存の純関数（投影・暫定座標・request採番）
                  src/*.tsx   … React Flow projection（DOM）
```

- React Flowのnode／edge objectをcanonical stateにしない
- node position、edge端点、pan／zoom、viewport、selection、dragはReact Flowが所有する。FQuery側でDOMを測らない
- gestureは`node.move.requested`／`connection.add.requested`／`node.select.requested`へ変換するだけで、Modelを書かない
- drag中の座標は`DraftLayoutState`として描画専用に持ち、decisionが届いたら破棄する。rejected時の位置復帰はaccepted layoutの再投影だけで起き、rollback用の補正codeを持たない
- `src/model/`はReact NativeなどDOM以外のbackendと共有する候補。DOM APIと`@xyflow/react`をimportしない

## component

- canvas: `FQueryFlowView`、`FQueryFlowNode`、`FQueryGenericNodeContent`、`PresentationCanvasHandle`
- pane: `FQueryPane`（slot式contribution）、`FQueryOutliner`、`FQueryPalette`
- inspector: `FQueryNodePanel`（設定／接続／Q／Unsupported Data／RAW FAM）、`FQueryFamvim`
- その他: `FQueryRecordsPanel`、`FQueryNode`／`FQueryPanel`

## 検証状態

- automated test: 投影純関数、暫定座標reducer、component描画とevent emit、pane／Node Panel／FAMVIMの契約（jsdom）
- human test: Node Editorの操作項目は`apps/playground`で合格（2026-09-08、User確認）。Host組み込みは未実施
