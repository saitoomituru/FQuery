# @fquery/fam-core

FAM JSON Coreのframework非依存machine contract。FAMはopen-worldであり、base構造と追加profile拘束を分離する。

- `fam.json/0.1.0-draft`
- top-levelおよびnested nodeの最小`ψ / ∇φ / λ / Q`構造検証
- 未知fieldを拒否・削除しない
- 未変更documentの原文byte round-trip
- provider structured output用profile Schema
- 必要な経路だけへ注入するlanguage lineage profile
- 翻訳要求時に`λ.sub_splitters`へ写本を保持するtranslation profile
- decomposition profileのroot `∇φ`をarrayへ固定せず、container表現とTopology Normalizerを分離

原典Markdown自体をstrict JSONとして扱わない。原典の構文補正や抽出結果は、原典archiveとは別artifactとreceiptへ分離する。

現行`0.1.0-draft`実装には、`title`、lineage、言語metadata、`Q.unknown_is_absence`等のprofile fieldをbase受理条件として扱う箇所が残る。これは完成仕様ではなくIssue #22で追跡するimplementation driftである。
