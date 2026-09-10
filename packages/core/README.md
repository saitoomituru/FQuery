# @fquery/core

backend非依存のAST、graph、binding、projection、validation、再帰停止を提供するNode.js参照実装。

旧FAMの単一`Q.status`は、`projectLegacyQStatus`で現行の直交status軸へ部分投影できる。旧値から判定できない軸は既定値で埋めず、`unmappedAxes`とloss noteへ残す。逆方向の`summarizeAsLegacyQStatus`も常にlossyである。

`planParallelFold`はparent contextとchild依存から実行候補waveを作る。独立childだけを同じwaveへ置き、未検証、依存欠損、cycleを別reasonで保持する。返るplanはprovider処理や副作用の実行権限を付与しない。

Selector / Topology Normalizerは次を分離する。

- `self`はcurrent FAM module、`this`はcurrent node
- `parent / children / siblings`はcurrent Fold内のcontainment
- `prev / next`はL structural edge、`before / after`はmL runtime edge
- arrayはparallel sibling collection、object keyはaddressable unit
- layer意味分類はObserver / refFAM、layer pointer存在検証はCore
- cross-FAMは`fam_ref`をmodule graphとして解決し、inline recursive copyしない

`projectTopologyForRunner()`と`projectTopologyForPresentation()`は同じnormalized revisionから別用途の入力を作る。後者はrenderer正本ではなく、pixel layoutやReact Flow IDを持たない。

`assessFamExtraction()`は共有、cross-Fold、独立revision、lossless normalization不能を独立FAM extraction候補へ送るが、内容の価値・真偽・refFAM種別は裁定しない。

`validateAdapterCapabilities()`はobjective factとsubjective truthの必要能力を分離する。取得成功はObserverによる採用を意味しない。
