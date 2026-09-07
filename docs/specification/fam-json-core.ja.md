# FAM JSON Core 0.1.0-draft

## 責務と解釈時点

FQueryはFAMのmachine contractを `fam.json/0.1.0-draft` として保持する。保存済みのFoldAccessMapper 0.2.1-alpha原典は歴史資料であり、この仕様は原典の4軸をJSON transportへ写像した現在時点のInterpretation OAEである。

## 4軸node

FAM nodeは常に `ψ / ∇φ / λ / Q` の4軸を同時に持ち、各軸の内部へ再帰できる。

- `ψ`: trigger、source、観測された意味波形
- `∇φ`: 意識・意味gradientと選択経路
- `λ`: 顕現する出力と目的
- `Q`: mode、Observer、Registry、fact scope、unknown等の制御境界

top-levelは4軸に加えて `fam_id`、`revision_id`、`kind`、`title`、`index_subjects`、`pointers`、`provenance` を持つ。未知fieldは破棄しない。

## 入力言語が正本

正本言語は日本語固定ではない。日本語入力なら日本語、アラビア語入力ならアラビア語、古代ヘブライ語入力ならその入力が正本になる。scriptだけで時代・方言まで断定できない場合は、例えば `und-Hebr` として判定不能を残し、存在しない精度を捏造しない。

分解profileではrootと各unitが `ψ.source_language` を共有する。各unitの `ψ.source_text` はroot原文の改変されていない部分文字列であり、`∇φ[*].source_expression` と `λ.manifestation` も同じ原言語表現を保持する。`λ.manifestation_language` も入力言語と一致する。翻訳でこれらを置換したrecordはrejectする。

## 翻訳sub-splitter写本

他言語は正本FAMを置換せず、各unitの `λ.sub_splitters` にnested FAMとして置く。翻訳写本は次を保持する。

- `ψ`: 正本原文、`source_language`、`target_language`
- `∇φ`: 翻訳または音写の変換経路
- `λ.manifestation`: target言語の写本
- `Q.copy_role`: `translation-witness`
- `Q.source_node_ref`: 翻訳元nodeへの参照
- `Q.translation_error`: `status`、`metric_refs`、追記可能な`measurements`

未測定の翻訳誤差は `not-evaluated` であり、誤差ゼロを意味しない。後続評価は測定法と結果を `metric_refs` / `measurements` に保持し、どのrevisionの写本を測ったか追跡する。

## unknownと旧blocks境界

取得不能や未確認は不存在ではない。`Q.unknowns` は原言語の `source_expression`、その `source_language`、機械可読な `concept_id` を分けたobject配列として保持し、`Q.unknown_is_absence` は常に `false` とする。識別子が英語風でも、それを原言語表現の代用品にはしない。`fquery.candidate-fam/0.1.0-draft` の `blocks[]` はFAMではなく、必要ならPresentation用の別recordとして保持する。`application/fam+json` やFAM paneへ昇格させない。

## byte保存

`readFamJson` は未知fieldを含む値を読み、未変更documentは `writeUnmodifiedFamJson` により元のJSON文字列をそのまま返す。これはJSON FAM documentのbyte保存境界であり、Proton原典そのもののbyte保存は `proton/origins/` のreceiptが正本である。
