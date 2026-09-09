# Issue #35 Browser Playground引継ぎ票

状態: `LEGACY-AUTOMATED-PASS / OPEN-WORLD-AUTOMATED-WAIT / SAFARI-HUMAN-FAIL / CHROME-HUMAN-FAIL`

対象revision: `da4bc93` 以降（実施時のHEADを記録すること）

## 2026-09-08 Human Test観測

- 追加retestの1回目はChromeで背景だけの黒画面となり、app headerやnodeが一切描画されなかった。画面証拠だけではmodule load失敗、HMR切替、React初期化例外のどれかを確定できないため、原因は`UNKNOWN`とする。
- 2回目は画面が描画されたが、Gemini生成候補の`$.λ.output_units[2].Q.unknown_is_absence`欠落を`unknown-absence-boundary-required`として拒否し、`FQUERY-PLUGIN-CALL-FAILED` Last Orderとなった。これはtransport失敗ではなくprovider出力とFQuery profile不変条件の境界事故である。
- 上記2件に対し、初期module／React描画失敗を黒画面にせず停止理由と再読込導線へ変換し、`unknown_is_absence=false`とstable unit identityだけをFQuery profile側で局所補正して補正pathをevent receiptへ残す修正を実施した。実Chrome／Safariの再Human Testは未実施であり、状態は不合格のままとする。
- その後のretestで全unitとrootの`unknown_is_absence`欠落が旧`FQUERY-PLUGIN-CALL-FAILED`経路へ再び到達した。3000番を保持していたViteは約9時間52分前に起動したprocessであり、frontend HMRだけが新しくgatewayの`plugin-gemini/dist`が旧版のまま残るsplit-brainを確認した。従来testもGemini adapter単体とgateway fixture routeが分離しており、この結合事故を検出できていなかった。
- 修正後retestでもChrome、Safariの両方が初回Gemini decompositionを完了できず不合格となった。
- 両browserで`plugin resolved`後に`transport failed`、または`plugin running / transport not-requested`のまま停止する状態が観測された。browser差より手前のprovider generate／validation／timeout境界が共通原因候補だが、取得済み画面だけでは原因を一つに確定できないため`UNKNOWN`を保持する。
- Chromeは初回decomposition時点で`transport failed`となり不合格。component testは実Browser testではなく、この不合格を覆さない。browser固有原因は`UNKNOWN`のまま保持する。
- Safariではdecompositionと「なんで？-DeFold-」の結果表示まで進行した。
- Safariの左pane tabに横・縦scrollbarが発生した。
- unitを「ただし降水確率68パーセントである」へ差替えた際、最終λへ自動反映されず、FoldLog edit recordも表示されなかった。
- 「なんで？-DeFold-」にbusy表示とchattering防止がなく、連打で子nodeが増殖し、親子chainが千切れた。
- 子graphを閉じるnested boundaryがなく、意味上一括解決すべき範囲がpresentationから失われていた。
- 追加retestでは1段目のdecomposition表示までは成功した。ただしunitを降水確率へ差し替えてもλ再投影が起きず、Human Testは継続して不合格である。
- 2段目の「なんで？-DeFold-」では、対象∇φ nodeが撤去・Fold化されず旧panelが残り、その外側に別Fold boundaryが追加された。新boundaryはdrag不能で、外Ψ／内Ψ／内λ／外λを中継するpatch-bayも無かった。
- 同retestで`decomposition-kind-required` Last Orderを観測した。`fam.decompose` provider候補のprofile-owned `kind`が投影前に固定されていない経路と判定し、本文を発明せず`kind: decomposition`へ補正してreceiptへ`$.kind`を残す修正対象とした。
- Issue #41の長文観測では、ほぼ全unitをroot Ψとλへ直接接続する巨大fan-out/fan-inを確認した。原因候補は、active refFAMのprovider前段未注入、refFAM自体の一括平坦化前提、Core/profile validatorの過剰拘束、projectionのparentage欠落のいずれか、または複合であり、画面証拠だけでは単一原因を確定しない。#35側で見た目だけを偽nested化せず、生成・検証・投影の各revisionを#41で切り分ける。
- User実文のHuman Testでは、因果鎖を持つ4要素が全てroot直下へ平坦化された。少なくとも「事実domainで1・2が並列、その後3→4」または「Element観測1・2、その後3・4を暫定Astral Foldとして保持し後でDeFold」という複数の非排他的候補を比較できる必要がある。一つの期待解へ固定するのでなく、L/mL/G/Dを保つ候補branchとObserver verdictを記録する。

以上はUser提供screen captureと操作観測であり、修正後のHuman合格を意味しない。

## 自動検証済み

- decomposition FAMの各unitがstable `Q.unit_ref`、unit revision、親FAM revisionを持つ
- 現行testはprovider候補で欠けたstable identityまたは`unknown_is_absence=false`を局所補正し、補正pathを`plugin-call-end.normalization`へ記録する経路を検証する。ただしbase FAMとdecomposition profileの適合状態分離は未実装であり、このtest passを新しい#22 acceptanceの達成とは数えない
- `fam.decompose` provider候補の`kind`欠落／逸脱をFQuery decomposition profile境界で`decomposition`へ補正し、`$.kind`をnormalization receiptへ記録する
- gatewayからGemini adapter、profile正規化、Core wire resultまでを一本で通すref FAM結合testを持つ
- backend runtimeのbuild artifact更新時にVite serverを再起動し、frontendとgatewayの新旧split-brainを防ぐ
- 初期module loadまたはReact初期化が失敗しても無言の黒画面にせず、停止理由と再読込導線を表示する
- テスト用Basic Commons Access Mapper自体がrevision固定FAMであり、World/Astral/Element/unknown分類とTC2局所gateを注入する
- 初期placeholderから、分解後に `1 Ψ → N ∇φ → 1 λ` の独立nodeへ投影する
- 選択unitだけの差替えで兄弟unit、親FAM拡張field、旧revisionを保持する
- TC2の`38→68`はactive branchを保持し、`38→0`はfallbackを発明せず`needs-recomposition`としてstale λ出力を遮断する
- 「なんで？-DeFold-」の操作語をcanonical sourceへ混ぜず、選択unit原文だけから子decomposition FAMを生成する
- 「なんで？-DeFold-」の対象∇φを別nodeのまま残さず、同じstable node IDの`atomic-resolution / single-processing-unit` Fold boundaryへ置換する
- Fold boundaryが既存の外Ψ／外λ connectionを保持し、内Ψ／内λ gateを介して子graphを一本の連鎖として中継する
- 2段目DeFoldでも対象childを同一IDのnested Foldへ置換し、G=2と4つの外内gateを保持する
- Fold boundary headerをdrag可能とし、4つのpatch-bay HandleをReact Flowへ投影する
- Fold boundaryの`boundary_metrics`としてG、context D、tool L、context mL、SのLast Order／明示domain branch契約を分離する
- 同一親の「なんで？-DeFold-」を一実行へ直列化し、busy表示、同一fingerprint cache、旧応答遮断を行う
- 「まとめる-Fold-」で中間表現を削除せず子孫nodeと内部edgeのcanvas描画を止め、縮小boundaryだけを投影する
- 縮小boundaryの「ひらく-DeFold-」で同じ子graphを再描画する。`unFold`は破壊的結合の予約語であり、この操作では実行しない
- FAM store通知をSession commit後へ移し、unit差替えをλとFoldLog edit recordへ同じ確定revisionから投影する
- Safari pane tabを固定幅scroll領域にせず、pane幅内へ縮約する
- decompose、edit、validate-edge、recursive-decomposeを`fold.log/0.1.0-alpha` / `oae.record/0.1.0-alpha`として生成し、secret redaction境界を保持する
- `ja-JP`を既定にし、schema key・URIを翻訳せず`en-US`表示へ切替できる

## 自動検証待ち

- provider候補にstable identity、`kind`、`unknown_is_absence`等のprofile fieldが無くても、4軸base FAM候補を失わず`profile_conformance=not-satisfied`または`not-evaluable`として返す
- Schema未登録fieldを追加したFAMをlosslessに読書きし、追加fieldの存在だけではbase／profileのいずれもrejectしない
- 同一sourceに複数topology候補を持たせ、一方の採用scopeが他branchを削除しない

## Human GUI Test

1. SafariとChromeでそれぞれ`npm run dev`の`http://127.0.0.1:3000`を開き、初回からheaderと初期graphが表示されることを確認する。失敗時は黒画面ではなく起動失敗理由が表示されることを確認する。
2. 「降水確率は38%である。不安である。傘を持つ。」をfixtureで分解し、3つの独立∇φ nodeと1つのλ nodeが見えることを確認する。
3. 第1unitを「降水確率は68%である。」へ差替え、λが3行を保持することを確認する。
4. 第1unitを「降水確率は0%である。」へ差替え、影響nodeがstale表示になり、λが「再構成待ち」で旧3行を表示しないことを確認する。
5. Recordsで取消gate、affected Fold、`persistenceStatus: volatile`が読めることを確認する。
6. unitの「なんで？-DeFold-」を連打し、最初の1要求だけが走ること、`DeFold中…`表示になること、子graphが1つのatomic Fold boundary内へ生成されることを確認する。
7. 旧∇φ panelが残らず同一node IDのFoldへ置換され、外Ψ／内Ψ／内λ／外λの4 gateで既存の一本のchainが保持されることを確認する。
8. Fold内のchildで「なんで？-DeFold-」を実行し、そのchild panelが同一IDの2段目Foldへ置換され、G=2、4 gate、grandchildが表示されることを確認する。
9. boundaryをdragできることを確認する。boundaryの「まとめる-Fold-」で子graphが一つの縮小node表示になり、「ひらく-DeFold-」で同じgeneration、revision、metricsの子graphへ戻ることを確認する。
10. Access Mapper / evidenceを開き、FAM IDとrevisionが読めることを確認する。
11. localeをEnglishへ切替え、機械可読key・URI・`unit_ref`が変化しないことを確認する。
12. 左paneに不要なtab scrollbarが再発せず、tab操作とpane本文scrollが分離していることを確認する。
13. Geminiで3unitを分解し、provider候補に`unknown_is_absence`または`kind`が無くても4軸base構造の表示を失わず、decomposition profileの非適合を別状態で確認できることを確認する。FQueryが機械的に確定できるfieldを局所補正した場合だけ、Recordsの`plugin-call-end.normalization.repairedPaths`で補正箇所を確認する。
14. Xのtimeline、小説、Web記事等から権利・個人情報の扱える範囲で無作為に選んだ実文と、日本語・英語・codeが混在する実文を投入する。機械的な言語分割や全unitのflat fan-outに逃げず、人間から見てcontext、包含、順序、Fold boundaryが妥当かを観測する。本文の恒久複製を既定にせず、source URLまたは投入ref、取得時刻、対象範囲、subject revision、observer ref/domain、適用したOAE rule ref、verdict、evidence refを記録する。別observerの相反するverdictは上書きせず、別OAEとして併記する。
15. 公式game／映画／作品情報や制作者interviewでは、現実のpublisher／studio、公開行為、製品、作品World、game build、作中Event、制作者の制作経験、登場人物の経験、受け手の心象を別refとして観測する。同じ公式sourceや同じ「苦労」等の語彙だけを理由に同一Worldへmergeしていないことを確認する。

Codexが公開sourceから決定論的に抽出した最初の候補と、そのHuman未評価境界は
[`observer-source-candidate-20260909.ja.md`](observer-source-candidate-20260909.ja.md)に記録する。

## 完了に含めない境界

- Browser内FoldLog alphaはOAEレコードを生成できるが、永続OAE管理システムではない。
- IBDのvector graph DBとRDBへの二重永続化、取得、整合receiptは後続Issueである。
- 実RAG/World provider、VS Code Host、Sphere Hostの確認は#35へ混ぜない。
- この票の自動テストは、人間による配置、可読性、drag、操作感の確認を代替しない。
- 自動validator合格はcontext一致を意味しない。Human Testの`matched`／`not-matched`もglobal truthではなく、指定OAE rule下のobserver verdictとして扱う。
- Playwright等の別browser engine試験も、実Safariまたは実ChromeのHuman Testを代替しない。
