# @fquery/ui-vue

Vue 3のPresentation View。`FQueryBaklavaView`はBaklavaJS 2.8.1をnode-editor surfaceとして使うが、Baklava graphをcanonical dataとして保存せず、`@baklavajs/engine`を導入しない。

- FAM／Presentation FAMから受けた`NodeViewModel`と確定済みconnectionを一方向投影する
- connection gestureは直接確定せず`connection.add.requested`へ変換する
- node移動は`layoutSlotRef`付き`node.move.requested`としてHostへ返し、engine／Hostから確定layoutが戻るまで元位置へ戻す
- plugin presentation検索、ghost／generic fallback、record pane分離を提供する

BaklavaJSはMIT Licenseの通常dependencyとしてlockfileへ固定する。semantic execution、Q、SIN、hash、divergence、ABI判定はこのpackageに置かない。

Vue 3による再利用可能なFQuery Presentation component。実行engineは所有しない。
