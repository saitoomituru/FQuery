# @fquery/host-sphere

Sphere hostとFQueryのtyped event／ViewModel境界。Sphere runtime実装済みの証拠ではない。

`createSphereHostBridge`は`send`を持つportだけを要求し、Vue componentとSphere runtimeを分離する。
実Sphere Runnerへの組み込みと人間による画面確認は未実施。
