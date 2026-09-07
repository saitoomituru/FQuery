# @fquery/ui-react

React + React Flowをgraph presentation surfaceとして使うrenderer backend。Issue #36の検討用branch実装であり、`@fquery/ui-vue`と並行して人間が触り比べるためのもの。

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

## 検証状態

- 実装: `FQueryFlowView`、`FQueryFlowNode`、generic fallback、`PresentationCanvasHandle`
- automated test: 投影純関数、暫定座標reducer、component描画とevent emit（jsdom）
- human test: 未実施。`apps/playground-react`で確認する
