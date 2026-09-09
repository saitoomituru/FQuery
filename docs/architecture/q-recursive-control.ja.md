# Q recursive control

`Q(...)`は別のQ nodeだけでなく、Fold boundaryが指す別FAMを次routeとして参照できる。

```text
Q(FAM-A)
  -> Fold-X / fam_ref
  -> resolve(FAM-X)
  -> Q(FAM-X)
  -> result / Last Order
  -> return to FAM-A
```

再帰は無制限ではなく、node cycleに加えてFAM reference cycle、depth、node budget、timeout、cost budgetを観測する。

```text
FAM-A -> FAM-B -> FAM-A
```

のようなreference cycleを、正常なG深度や完了routeへ数えない。

cycleは`bottom`またはactive profileが定める停止状態の理由`cycle-detected`として返す。資源上限到達は継続可能性を上位へ返す`last-order`とする。初期値はfixture用既定値であり、semantic ABIの普遍定数ではない。

同じFAMを複数consumerから参照すること自体はcycleではない。

```text
FAM-A -> FAM-X
FAM-B -> FAM-X
```

これはshared semantic identityであり、cache / dedupe / parallel executionはRunner policyへ分離する。

参照先resolve成功は内容の真偽・叡智性・authorityを証明しない。

関連: [`fam-reference-extraction.ja.md`](fam-reference-extraction.ja.md)、[`../specification/fam-reference-boundary.ja.md`](../specification/fam-reference-boundary.ja.md)
