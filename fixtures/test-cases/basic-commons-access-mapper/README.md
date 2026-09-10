# Basic Commons Access Mapper

Issue #35 / #41 / #42の自動testで使う共有Access Map FAMである。

- `generic-access-map.fam.json`: 自然言語一般のPlayground既定。World/Astral/Element/unknownとL/mL topologyの交換面だけを持ち、天候語彙、特定作品、特定vendorへ最適化しない
- `access-map.fam.json`: Issue #35の降水確率・causal gateを再現する明示選択fixture。一般入力へ自動注入しない

- 分類規約自体をFAMとしてrevision管理する
- 上位Systemは`fam_id`と`revision_id`を固定して別Access Map FAMへ交換できる
- `world-fact`、`astral-fact`、`element-projection`、`unknown`はこのfixture Registry内のclaim kindであり、全Worldの普遍分類ではない
- Access Mapの存在はTransformer実行、classification成立、OAE永続化を意味しない
- 一致しないclaim kindは捨てず`unmapped`として保持する
- このfixtureが返す分類は候補であり、別refFAMによる別解釈と非ゼロサムで併存できる
- fixtureのfield集合をFAM Coreの必須列へ昇格せず、選択profileとしてnegotiationする
- profile不適合はObserverのsidecar評価として保持し、base 4軸を読めるcandidateの棄却やLast Orderへ自動変換しない

このdirectoryはtest用commonsであり、Manifest／IBDの正本Registryへ自動昇格させない。
