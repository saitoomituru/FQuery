# FQuery architecture overview

FQueryはFAMの保存backend、model、vector、HTTP、deviceを所有しない。CoreはQueryの構造、binding、projection、検証、再帰停止とplugin境界を所有する。

```text
Presentation / Host
  -> typed ViewModel and events
Q Core
  -> AST / graph / binding / projection / status
Plugin SDK
  -> capability resolution / invoke envelope
FAMLog
  -> append-only observable events
Backend adapter
  -> IBD / model / vector / HTTP / device
```

各矢印は実装成功と意味成功を別々に返す。外部adapterの成功だけで`lambda_status: satisfied`へ遷移しない。
