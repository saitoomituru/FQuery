# Basic Commons Access Mapper

Issue #35の自動testで使う、最小の共有Access Map FAMである。

- 分類規約自体をFAMとしてrevision管理する
- 上位Systemは`fam_id`と`revision_id`を固定して別Access Map FAMへ交換できる
- `world-fact`、`astral-fact`、`element-projection`、`unknown`はこのfixture Registry内のclaim kindであり、全Worldの普遍分類ではない
- Access Mapの存在はTransformer実行、classification成立、OAE永続化を意味しない
- 一致しないclaim kindは捨てず`unmapped`として保持する
- このfixtureが返す分類は候補であり、別refFAMによる別解釈と非ゼロサムで併存できる
- fixtureのfield集合をFAM Coreの必須列へ昇格せず、選択profileとしてnegotiationする

このdirectoryはtest用commonsであり、Manifest／IBDの正本Registryへ自動昇格させない。
