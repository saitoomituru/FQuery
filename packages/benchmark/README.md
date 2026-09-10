# @fquery/benchmark

同一`QueryNode`を複数のplugin/model routeへ渡し、直交状態軸とFAMLogを比較するrunner。
性能値とsemantic適合は単一scoreへ潰さない。

## 非線形Observer OAE比較

`compareNonlinearObserverOae`は、Human、Gemini、Codex等が同一subject revisionへ返した
構造解釈をOAE同士として比較する。Context Dimension、Fold boundary、semantic relation、
tool relation、代替branch、unknownを別々のJaccard比と差分集合で返し、単一総合点、勝者、
global truthを生成しない。

`fixtures/benchmark/nonlinear-fpga-post.json`はHumanがランダムに選んだ実文について、
Human期待、Gemini候補のBrowser観測、Codexの設計review解釈を別recordで保持するreplay fixture。
これはlive provider testやHuman合格を意味しない。
