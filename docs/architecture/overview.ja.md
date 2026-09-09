# FQuery architecture overview

FQueryはFAMの保存backend、model、vector、HTTP、deviceを所有しない。CoreはQueryの構造、binding、projection、検証、再帰停止とplugin境界を所有する。

```text
Presentation / Host
  -> 複数FAM projectionを合成表示。renderer graphは正本ではない
Q Core / Runner
  -> query / binding / projection / status / recursive resolve
FAM reference layer
  -> independent FAM identity / Fold boundary / ref resolution
Plugin SDK
  -> capability resolution / invoke envelope
FAMLog
  -> append-only observable events / extraction & promotion receipt
Backend adapter
  -> IBD / model / vector / HTTP / device / persistence
```

Foldは同一graph内のhidden child groupではなく、独立FAM identityへのreference boundaryを正規形とする。複数consumerが同じ意味subtreeを必要とした場合、shared node DAGへ拡張せず独立FAM extraction candidateへ送る。

詳細:

- [`../specification/fam-reference-boundary.ja.md`](../specification/fam-reference-boundary.ja.md)
- [`fam-reference-extraction.ja.md`](fam-reference-extraction.ja.md)
- [`../specification/fold-boundary-runner.ja.md`](../specification/fold-boundary-runner.ja.md)

各矢印は実装成功と意味成功を別々に返す。外部adapterの成功だけで`lambda_status: satisfied`へ遷移しない。FAM reference解決成功も、そのFAM内容の真偽・叡智性・authorityを証明しない。
