# @fquery/core

backend非依存のAST、graph、binding、projection、validation、再帰停止を提供するNode.js参照実装。

旧FAMの単一`Q.status`は、`projectLegacyQStatus`で現行の直交status軸へ部分投影できる。旧値から判定できない軸は既定値で埋めず、`unmappedAxes`とloss noteへ残す。逆方向の`summarizeAsLegacyQStatus`も常にlossyである。
