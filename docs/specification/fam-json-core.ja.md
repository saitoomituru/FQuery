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

分解profileのCore validatorは、分類後FAMが`ψ / ∇φ / λ / Q`と必須lineage fieldを持つかを機械検証する。入力内容の言語を機械分割せず、日本語・英語・C言語等が混在する入力は混在したコンテキストのまま出力できる。`source_language`等はそのnodeが宣言する非空metadataであり、rootと全unitの単一言語一致やbyte一致をCoreの受理条件にしない。

翻訳命令が無い場合は入力と出力の言語・code register・意味構造を維持する。ただしその一致はbyte列一致やscript検出ではなくcontext-levelのsemantic contractであり、Core shape validatorが内容を裁定しない。検証器またはactive refFAMが測定できない場合は`not-evaluated`／`unknown`として残し、別言語混入だけを理由にFAM全体をrejectしない。

byte一致が必要な経路はSQL／IBD等の外部storage/verifier pluginがhashを比較し、使用algorithm・比較対象・一致結果をreceiptに残す。context一致を測る経路は人間、別LLM、embedding/vector verifier等の観測者が、そのWorldで指定されたOAE拘束rule refに従って観測OAEを生成する。FQueryはどの観測者の`matched`／`not-matched`が正しいかを裁定せず、相反する観測も別OAEとして併存させる。

ゲームWorldのsystem event、科学Worldの追試、心象Worldの当事者感覚など、何を成立条件とするかはrule ref側に記述し、FQuery Coreへhard-codeしない。FQueryが機械検証するのは、候補OAE recordを指定rule refの拘束下で確定可能か、およびその評価receiptがrule／candidate record／evaluatorへrevision固定で束縛されているかである。ruleまたはevaluator未接続時は未評価のまま保持し、推測で成立へ昇格させない。

LLMの分類事故は起こり得るものとして受容し、FAMの編集性とrevision履歴で修正可能にする。Coreが機械的に保証するのはshape、差分、書換えの発生、修正receipt、API実行結果／空振り等であり、分類内容の正しさそのものではない。

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

`Q.unknown_is_absence=false`とdecomposition unitのstable identityはproviderが判断するWorld factではなく、FQuery decomposition profileが所有する構造的不変条件である。provider候補でこれらが欠落した場合、consumerは本文や`Q.unknowns`を発明せず当該不変条件だけを局所補正できる。ただし補正を無言で正本化せず、profile refと補正JSON pathをnormalization receiptへ記録する。その他のvalidator違反はprovider出力不正としてLast Orderを返す。

## byte保存

`readFamJson` は未知fieldを含む値を読み、未変更documentは `writeUnmodifiedFamJson` により元のJSON文字列をそのまま返す。これはJSON FAM documentのbyte保存境界であり、Proton原典そのもののbyte保存は `proton/origins/` のreceiptが正本である。
