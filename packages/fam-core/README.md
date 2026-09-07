# @fquery/fam-core

FAM JSON Coreのframework非依存machine contract。

- `fam.json/0.1.0-draft`
- top-levelおよびnested nodeの`ψ / ∇φ / λ / Q`検証
- 未知fieldを拒否・削除しない
- 未変更documentの原文byte round-trip
- provider structured output用Schema
- 入力言語の分解結果を正本にするlanguage lineage
- 他言語出力を`λ.sub_splitters`の翻訳写本へ隔離し、翻訳誤差ledgerを保持

原典Markdown自体をstrict JSONとして扱わない。原典の構文補正や抽出結果は、原典archiveとは別artifactとreceiptへ分離する。
