# FAM JSON Core 0.1.0-draft

状態: `DESIGN-CORRECTIVE / IMPLEMENTATION-DRIFT`（Issue #22）

## 責務と解釈時点

FQueryはFAMのmachine contractを `fam.json/0.1.0-draft` として保持する。保存済みのFoldAccessMapper 0.2.1-alpha原典は歴史資料であり、この仕様は原典の4軸をJSON transportへ写像した現在時点のInterpretation OAEである。

現行のFAMJSON / FAMLog / refFAM / 情報子 / Fold参照境界に関する思想正本は、ZeroRoomLab-manifest
[`fam-infoton-reference-boundary.ja.md@85d1b5d`](https://github.com/saitoomituru/ZeroRoomLab-manifest/blob/85d1b5db8d46f34671d38a451617c08edff41675/docs/theory/fam-infoton-reference-boundary.ja.md)
をrevision固定で参照する。

OAE拘束成立、複数Observer、World分離等の横断正本は既存Manifest文書を参照し、FQueryはWorldごとのrule内容を複製・hard-codeしない。

## 1. open-worldの4軸最小構造

FAM nodeのbase structural handshakeは `ψ / ∇φ / λ / Q` の4 keyだけである。各軸の内部へ再帰でき、各軸の内容は未記入、`unknown`、scalar、object、またはprofileが認識するnested valueを取り得る。全項目を一回で埋める義務はない。

- `ψ`: trigger、source、観測された意味波形
- `∇φ`: 意識・意味gradientと選択経路
- `λ`: 顕現する出力と目的
- `Q`: mode、Observer、Registry、fact scope、unknown等の制御境界

`fam_id`、`revision_id`、`kind`、`title`、`index_subjects`、`pointers`、`provenance`、言語lineage、Access Mapper、OAE、reference binding等は、利用するprofileが追加要求できる拡張fieldである。base FAMの必須列へ昇格しない。

未知fieldや規定外fieldを拒否・削除・renameせずlosslessに保持する。

## 2. 構造適合とartifact roleを混同しない

4軸が読めることは`base_structure`の成立であり、それだけで「FAMJSONとして情報子が成立した」「refFAMである」「factである」を意味しない。

適合軸を分離する。

```text
base_structure
  ψ / ∇φ / λ / Qを持つFAM構造として読めるか

profile_conformance
  decomposition、translation、lineage、reference等の選択profileを満たすか

artifact_role
  OAE / FAMLog / FAMJSON / refFAM / unknown 等をどう解釈したか

service_negotiation
  plugin、adapter、socket、verifierを利用できるか

observer_verdict
  指定oae_rule_ref下でObserverが何と評価したか
```

`artifact_role`はFAM Coreのclosed enumへ固定しない。未知roleをinvalidとして破棄せず、profile / registry / Observerの判定を保持する。

profile未成立は`not-satisfied`または`not-evaluable`であり、base構造不正とは限らない。

## 3. FAMJSON = 情報子のwire representation

FAMJSONは「4軸JSONの別名」ではない。

ある意味単位が、その場限りの所感・観測を越え、別Context・別Fold・別処理から再参照される独立identityとして成立した時、その可搬単位を情報子（Infoton）としてFAMJSONへ記述できる。

```text
OAE / observation
  -> FAMLog
  -> 再参照可能なidentityが必要になる
  -> FAMJSON / Infoton
```

どこからも意味単位として参照されず、その場の観測・操作traceとして閉じているrecordを、shapeだけで情報子へ自動昇格しない。

root entrypointとしてHost / Runner / Humanから直接呼ばれるFAMは、そのentrypointが参照主体になる。Gitの被リンク数ではなく、意味処理系で独立identityとして再参照可能かを問題にする。

## 4. refFAM = metaphysical Schemer / wisdom method

refFAMは共有factの正解表ではない。

旧AQC `schemas/` / Schemerの責務をFAMへ統合し、次のような「ものの見方」を記述する。

- 何を存在として扱うか
- 何を同一／別物とみなすか
- どの問いを立てるか
- どの条件を試すか
- 何を観測・証拠とみなすか
- どこでunknown / Last Orderとするか
- どのWorldへどうmappingするか
- どのように追試・改善するか

この意味でrefFAMは形而上学的method / wisdomを記述する。

### factをrefFAMへ正典化しない

定量fact、個別観測、特定Worldのstate、法的・業務的事実等は通常FAMとして扱う。

profileに応じて`Q`へ次を要求できる。

```text
evidence_ref
observer_ref
subject_revision_ref
acquisition_method_ref
verifier_ref
hash / digest receipt
observed_at
```

hash比較は必要な経路だけでSQL / IBD / external verifier plugin等が行う。Core base validatorはbyte一致をfact成立条件へしない。

### 例: りんご / Newton / 科学

```text
「りんごが落ちた」
  -> 通常FAMの観測fact

「なぜ？」
  -> 問い

「別の物でも試す？」
「条件を変える？」
「別Observerでも追試する？」
  -> 対象を越えて再利用できるmethod
  -> refFAM candidate
```

叡智は壮大な真理である必要はない。答えそのものではなく、答えを生み、疑い、追試し、更新する可搬手続きも叡智である。

## 5. 複数参照と独立FAM extraction

同一FAM内の`∇φ` / subtree / Fold nodeを複数semantic consumerが必要とした場合、同一document内のshared node / DAGへ拡張しない。

FAM規約では、その時点を独立FAM extraction candidateとする。

```text
非正規形

Fold-A ─┐
        ├─ shared X
Fold-B ─┘

正規形

Fold-A -> ref ─┐
               ├─ FAM-X
Fold-B -> ref ─┘
```

複数参照は「真理」「純粋な叡智」の証明ではない。最低限、経験価値の可搬性が出たことを示す。

抽出後、fact / 合意 / 業務 / 個別経験を含むなら通常FAM、fact-freeな問い方・見方・方法・定規ならrefFAM candidateとして扱う。

詳細は[`fam-reference-boundary.ja.md`](fam-reference-boundary.ja.md)を参照する。

## 6. Fold / DeFoldとJSON ownership

Fold boundaryは独立FAM identityへのreference boundaryである。

parent FAMはchild内部nodeをcanonical hidden arrayとして所有し続けず、reference profileを通じてchild FAMを参照する。

```text
FAM-A
  -> Fold-X / fam_ref -> FAM-X
```

`まとめる-Fold-`はchild FAMを削除せずprojectionだけを畳む。

`ひらく-DeFold-` / `なんで？-DeFold-`はchild FAMをresolveしてviewへ投影する。child JSONをparent JSONへinline copyしない。

`unFold`のみ、独立FAM境界を破壊し得る操作として分離する。

具体契約は[`fold-boundary-runner.ja.md`](fold-boundary-runner.ja.md)を参照する。

## 7. 入力言語が正本

正本言語は日本語固定ではない。日本語入力なら日本語、アラビア語入力ならアラビア語、古代ヘブライ語入力ならその入力が正本になる。scriptだけで時代・方言まで断定できない場合は、例えば `und-Hebr` として判定不能を残し、存在しない精度を捏造しない。

base validatorは、分類後FAMが`ψ / ∇φ / λ / Q`を持つかだけを機械検証する。decomposition profileを選択した場合だけ、そのprofileが宣言するstable identity、lineage、revision binding等を別の`profile_conformance`として評価する。

入力内容の言語を機械分割せず、日本語・英語・C言語等が混在する入力は混在したコンテキストのまま出力できる。`source_language`等は任意profileのmetadataであり、未宣言だけを理由にbase FAMをrejectしない。

rootと全unitの単一言語一致やbyte一致もCoreの受理条件にしない。

翻訳命令が無い場合は入力と出力の言語・code register・意味構造を維持する。ただしその一致はbyte列一致やscript検出ではなくcontext-levelのsemantic contractであり、Core shape validatorが内容を裁定しない。

検証器またはactive refFAMが測定できない場合は`not-evaluated` / `unknown`として残す。

## 8. context一致とOAE

byte一致が必要な経路はSQL / IBD等の外部storage/verifier pluginがhashを比較し、algorithm、比較対象、一致結果をreceiptに残す。

context一致を測る経路は人間、別LLM、embedding/vector verifier等の観測者が、そのWorldで指定されたOAE拘束rule refに従って観測OAEを生成する。

FQueryはどの観測者の`matched` / `not-matched`が宇宙的に正しいかを裁定せず、相反する観測も別OAEとして併存させる。

ゲームWorldのsystem event、科学Worldの追試、心象Worldの当事者感覚など、何を成立条件とするかはrule ref側に記述し、FQuery Coreへhard-codeしない。

FQuery Coreは候補OAE recordとsubject / observer / rule revision refを保存・搬送する。shape / lineage / revision binding / rule conformanceを評価する場合は、選択されたObserver／evaluator adapterがその結果を別OAEとして返す。Coreはその評価結果をlosslessに保持するが、評価器やverdictのglobal truthを認証しない。

## 9. LLM分類事故と修正可能性

LLMの分類事故は起こり得るものとして受容し、FAMの編集性とrevision履歴で修正可能にする。

Coreが機械的に保証するのはshape、差分、書換えの発生、修正receipt、API実行結果 / 空振り等であり、分類内容の正しさそのものではない。

自然言語はWorld常識、関係、個人記憶、法・業界慣行、会話履歴等の暗黙Contextを環境的に解決することで意味が成立する不完全入力である。

FQueryは暗黙を禁止するのでなく、解釈時に使ったrefFAM、Access Mapper、corpus、tool、Observer、ruleを後から掘り、明示refで差し替えられるようにする。

解決receiptが無い場合は、もっともらしい出所を遡及生成せず`resolution-provenance-unavailable`を返す。

## 10. 複数解釈、合意、authority

一つのsourceに複数のFAM解釈が成立し得る。解釈Aをあるscopeで採用しても、解釈Bは誤りとして消えない。各branchは生成者、refFAM revision、Observer、適用rule、採用scopeを保持する。

「客観的」は無主体の絶対値ではなく、どのcorpus、Observer、instrument、rule、scopeで合意が成立したかを示す要求として扱う。

反対側も単なる`non-consensus`ではなく別の合意domainを持ち得る。

authorityは合意や能力から自動生成しない。どの解釈を採用し、どの副作用を許可するかは上位Systemがrevision固定refとして注入する。

Coreはrefの解決とscope / revision / operation拘束を検査するが、そのauthorityが宇宙的に正しいかを裁定しない。

## 11. 段階的なFold / DeFold

初回分解は完全解でなく、手直し可能な暫定Foldでよい。全field、全階層、全因果を一括展開して修正不要の正解を装うことを要求しない。

必要な箇所を`なんで？-DeFold-`で段階的に展開し、局所差替え、branch、revision、FAMLogにより修正可能にする。

同じ情報を含んでいても、全unitをroot直下へ並べたflat fan-outはG/D/L/mLやFAM reference boundaryを失った構造事故になり得る。

execution fan-outやrenderer都合をcanonical semantic topologyへ逆流させない。

## 12. 翻訳sub-splitter写本

他言語は正本FAMを置換せず、translation profileで正本sourceへの参照を保持した別FAM / nested projectionとして扱える。

profile例:

- `ψ`: 正本原文、source language、target language
- `∇φ`: 翻訳または音写の変換経路
- `λ`: target言語の写本
- `Q.copy_role`: `translation-witness`
- `Q.source_ref`: 翻訳元FAM / nodeへの参照
- `Q.translation_error`: status、metric refs、measurements

未測定の翻訳誤差は`not-evaluated`であり誤差ゼロを意味しない。

翻訳写本をsource FAMへinlineしてsource identityを上書きしない。

## 13. unknownと旧blocks境界

取得不能や未確認は不存在ではない。base FAMは`Q`内のunknown表現を一つに固定しない。

decomposition profileを選択した場合は、`Q.unknowns`へ原言語のsource expression、任意のlanguage metadata、machine-readable concept id等を分離して保持できる。

`Q.unknown_is_absence=false`等はprofileの追加拘束でありbase必須fieldではない。

旧`fquery.candidate-fam/0.1.0-draft`の`blocks[]`だけでは4軸base FAMにならないが、raw candidate / Presentation用の別recordとしてlosslessに保持できる。

provider候補でprofile fieldが欠落した場合、base FAM全体を不正とは呼ばず、当該profileを`not-satisfied`とする。

consumerが機械的に確定できるfieldだけを局所補正する場合も、本文やunknownを発明せず、profile refと補正JSON pathをnormalization receiptへ記録する。

## 14. byte保存

`readFamJson`は未知fieldを含む値を読み、未変更documentは`writeUnmodifiedFamJson`により元のJSON文字列をそのまま返す。

これはJSON FAM documentのbyte保存境界であり、Proton原典そのもののbyte保存は`proton/origins/`のreceiptが正本である。

FAM extraction / reference migrationを行う場合はbyte-identicalを要求しないが、before/after digest、移動したsemantic refs、unknown field retention、loss statusをreceiptに残す。

## 15. 実装drift

現行`@fquery/fam-core`、provider structured-output Schema、Playground sessionには、次のimplementation driftが残り得る。

- profile fieldの一部をbase受理条件としてrejectする
- nested child graphを同一FAM ownershipとして保持する
- Fold close/openを同一graph hidden stateで実現する
- artifact roleをbase valid / invalidと混同する

この文書の記述だけで修正済みとはしない。

Issue #22、#35、#41、#42および[`fam-reference-boundary-human-acceptance.ja.md`](../testing/fam-reference-boundary-human-acceptance.ja.md)の実装・Human Test完了まで`IMPLEMENTATION-DRIFT`を維持する。
