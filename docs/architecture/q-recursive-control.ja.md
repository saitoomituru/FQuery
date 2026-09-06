# Q recursive control

`Q(...)`は別のQ nodeを入力または次routeとして参照できる。再帰は無制限ではなく、cycle、depth、node budget、timeout、cost budgetを観測する。

cycleは`bottom`の理由`cycle-detected`として返す。資源上限到達は継続可能性を上位へ返す`last-order`とする。初期値はfixture用既定値であり、semantic ABIの普遍定数ではない。
