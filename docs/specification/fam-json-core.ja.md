# FAM JSON Core 0.1.0-draft

状態: `DESIGN-CORRECTIVE / IMPLEMENTATION-DRIFT`（Issue #22）

## 責務と解釈時点

FQueryはFAMのmachine contractを `fam.json/0.1.0-draft` として保持する。保存済みのFoldAccessMapper 0.2.1-alpha原典は歴史資料であり、この仕様は原典の4軸をJSON transportへ写像した現在時点のInterpretation OAEである。

OAE拘束成立、複数Observerの並存、制作主体と作品Worldの分離に関する横断正本は、
[ZeroRoomLab-manifest `0949625`](https://github.com/saitoomituru/ZeroRoomLab-manifest/blob/0949625b7472ff815bf1fba4f43c753e85f22eee/docs/theory/sphere-context-dimension-os.ja.md)
をrevision固定で参照する。FQueryはそのWorldごとのrule内容を複製・hard-codeせず、FAM JSONと
evaluation receiptの機械境界だけを所有する。

## open-worldの4軸最小構造

FAM nodeのbase structural handshakeは `ψ / ∇φ / λ / Q` の4 keyだけである。各軸の内部へ再帰でき、各軸の内容は未記入、`unknown`、scalar、object、またはnested FAMを取り得る。全項目を一回で埋める義務はない。

- `ψ`: trigger、source、観測された意味波形
- `∇φ`: 意識・意味gradientと選択経路
- `λ`: 顕現する出力と目的
- `Q`: mode、Observer、Registry、fact scope、unknown等の制御境界

`fam_id`、`revision_id`、`kind`、`title`、`index_subjects`、`pointers`、`provenance`、言語lineage、Access Mapper、OAE等は、利用するprofileが追加要求できる拡張fieldである。base FAMの必須列へ昇格しない。未知fieldや規定外fieldを拒否・削除・renameせず、losslessに保持する。

FAMの適合判定は次の層へ分ける。

```text
base_structure
  ψ / ∇φ / λ / Qを持つFAM構造として読めるか

profile_conformance
  decomposition、translation、lineage等の選択profileを満たすか

service_negotiation
  plugin、adapter、socket、verifierを利用できるか

observer_verdict
  指定oae_rule_ref下でObserverが何と評価したか
```

profile未成立は`not-satisfied`または`not-evaluable`であり、base構造不正とは限らない。USBのbase negotiation後に提供serviceが選択されるのと同様、4軸の成立と追加protocolの準拠度を混同しない。

## 入力言語が正本

正本言語は日本語固定ではない。日本語入力なら日本語、アラビア語入力ならアラビア語、古代ヘブライ語入力ならその入力が正本になる。scriptだけで時代・方言まで断定できない場合は、例えば `und-Hebr` として判定不能を残し、存在しない精度を捏造しない。

base validatorは、分類後FAMが`ψ / ∇φ / λ / Q`を持つかだけを機械検証する。decomposition profileを選択した場合だけ、そのprofileが宣言するstable identity、lineage、revision binding等を別の`profile_conformance`として評価する。入力内容の言語を機械分割せず、日本語・英語・C言語等が混在する入力は混在したコンテキストのまま出力できる。`source_language`等は任意profileのmetadataであり、未宣言だけを理由にbase FAMをrejectしない。rootと全unitの単一言語一致やbyte一致もCoreの受理条件にしない。

翻訳命令が無い場合は入力と出力の言語・code register・意味構造を維持する。ただしその一致はbyte列一致やscript検出ではなくcontext-levelのsemantic contractであり、Core shape validatorが内容を裁定しない。検証器またはactive refFAMが測定できない場合は`not-evaluated`／`unknown`として残し、別言語混入だけを理由にFAM全体をrejectしない。

byte一致が必要な経路はSQL／IBD等の外部storage/verifier pluginがhashを比較し、使用algorithm・比較対象・一致結果をreceiptに残す。context一致を測る経路は人間、別LLM、embedding/vector verifier等の観測者が、そのWorldで指定されたOAE拘束rule refに従って観測OAEを生成する。FQueryはどの観測者の`matched`／`not-matched`が正しいかを裁定せず、相反する観測も別OAEとして併存させる。

ゲームWorldのsystem event、科学Worldの追試、心象Worldの当事者感覚など、何を成立条件とするかはrule ref側に記述し、FQuery Coreへhard-codeしない。FQueryが機械検証するのは、候補OAE recordを指定rule refの拘束下で確定可能か、およびその評価receiptがrule／candidate record／evaluatorへrevision固定で束縛されているかである。ruleまたはevaluator未接続時は未評価のまま保持し、推測で成立へ昇格させない。

LLMの分類事故は起こり得るものとして受容し、FAMの編集性とrevision履歴で修正可能にする。Coreが機械的に保証するのはshape、差分、書換えの発生、修正receipt、API実行結果／空振り等であり、分類内容の正しさそのものではない。

自然言語は、World常識、関係、個人記憶、法・業界慣行、会話履歴等の暗黙Contextを環境的に解決することで意味が成立する不完全入力である。FQueryは暗黙を禁止するのでなく、解釈時に使ったrefFAM、Access Mapper、corpus、tool、Observer、ruleを後から掘り、明示refで差し替えられるようにする。解決receiptが無い場合は、もっともらしい出所を遡及生成せず`resolution-provenance-unavailable`を返す。

## 複数解釈、合意、authority

一つのsourceに複数のFAM解釈が成立し得る。解釈Aをあるscopeで採用しても、解釈Bは誤りとして消えない。各branchは生成者、refFAM revision、Observer、適用rule、採用scopeを保持する。

「客観的」は無主体の絶対値ではなく、どのcorpus、Observer、instrument、rule、scopeで合意が成立したかを示す要求として扱う。反対側も単なる`non-consensus`ではなく別の合意domainを持ち得る。個人と本人が用意したinstrumentによる合意は`locally-verified`として保持できるが、独立追試や社会的合意へ無断昇格しない。

authorityは合意や能力から自動生成しない。どの解釈を採用し、どの副作用を許可するかは、上位Systemがrevision固定refとして注入する。Coreはrefの解決とscope／revision／operation拘束を検査するが、そのauthorityが宇宙的に正しいかを裁定しない。

## 段階的なFold／DeFold

初回分解は完全解でなく、手直し可能な暫定Foldでよい。全field、全階層、全因果を一括展開して修正不要の正解を装うことを要求しない。必要な箇所を`なんで？-DeFold-`で段階的に展開し、局所差替え、branch、revision、FAMLogにより修正可能にする。

同じ情報を含んでいても、全unitをroot直下へ並べたflat fan-outは、G/D/L/mLを失った構造事故になり得る。execution fan-outやrenderer都合をcanonical semantic topologyへ逆流させない。G/D/L/mLの定義は[`fold-boundary-runner.ja.md`](fold-boundary-runner.ja.md)を参照する。

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

取得不能や未確認は不存在ではない。base FAMは`Q`内のunknown表現を一つに固定しない。decomposition profileを選択した場合は、`Q.unknowns`へ原言語の`source_expression`、任意の`source_language`、機械可読な`concept_id`等を分離して保持でき、`Q.unknown_is_absence=false`をそのprofileの追加拘束として要求できる。識別子が英語風でも、それを原言語表現の代用品にはしない。旧`fquery.candidate-fam/0.1.0-draft`の`blocks[]`だけでは4軸base FAMにならないが、raw candidate／Presentation用の別recordとしてlosslessに保持できる。

`Q.unknown_is_absence=false`とdecomposition unitのstable identityはproviderが判断するWorld factではなく、FQuery decomposition profileが所有する追加不変条件である。provider候補でこれらが欠落した場合、base FAM全体を不正とは呼ばず、当該profileを`not-satisfied`とする。consumerが機械的に確定できるfieldだけを局所補正する場合も、本文や`Q.unknowns`を発明せず、profile refと補正JSON pathをnormalization receiptへ記録する。補正不能なら候補を保持したままprofile非適合またはLast Orderを返す。

現行`@fquery/fam-core`およびprovider structured-output Schemaには、上記profile fieldの一部をbase受理条件としてrejectするimplementation driftが残る。この文書の記述だけで修正済みとはせず、Issue #22の実装・回帰試験が完了するまで`OPEN`として扱う。

## byte保存

`readFamJson` は未知fieldを含む値を読み、未変更documentは `writeUnmodifiedFamJson` により元のJSON文字列をそのまま返す。これはJSON FAM documentのbyte保存境界であり、Proton原典そのもののbyte保存は `proton/origins/` のreceiptが正本である。
