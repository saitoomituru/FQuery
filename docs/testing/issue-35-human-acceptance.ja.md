# Issue #35 Browser Playground引継ぎ票

状態: `AUTOMATED-PASS / SAFARI-RETEST-PENDING / CHROME-HUMAN-FAIL`

対象revision: `6e68470` 以降（実施時のHEADを記録すること）

## 2026-09-08 Human Test観測

- Chromeは初回decomposition時点で`transport failed`となり不合格。component testは実Browser testではなく、この不合格を覆さない。browser固有原因は`UNKNOWN`のまま保持する。
- Safariではdecompositionと「なんで？-DeFold-」の結果表示まで進行した。
- Safariの左pane tabに横・縦scrollbarが発生した。
- unitを「ただし降水確率68パーセントである」へ差替えた際、最終λへ自動反映されず、FoldLog edit recordも表示されなかった。
- 「なんで？-DeFold-」にbusy表示とchattering防止がなく、連打で子nodeが増殖し、親子chainが千切れた。
- 子graphを閉じるnested boundaryがなく、意味上一括解決すべき範囲がpresentationから失われていた。

以上はUser提供screen captureと操作観測であり、修正後のHuman合格を意味しない。

## 自動検証済み

- decomposition FAMの各unitがstable `Q.unit_ref`、unit revision、親FAM revisionを持つ
- テスト用Basic Commons Access Mapper自体がrevision固定FAMであり、World/Astral/Element/unknown分類とTC2局所gateを注入する
- 初期placeholderから、分解後に `1 Ψ → N ∇φ → 1 λ` の独立nodeへ投影する
- 選択unitだけの差替えで兄弟unit、親FAM拡張field、旧revisionを保持する
- TC2の`38→68`はactive branchを保持し、`38→0`はfallbackを発明せず`needs-recomposition`としてstale λ出力を遮断する
- 「なんで？-DeFold-」が別の子decomposition FAMを生成し、親unitの下へdepth付き子Foldを投影する
- 「なんで？-DeFold-」の子graphを`atomic-resolution / single-processing-unit`のFold boundaryへネストする
- Fold boundaryの`boundary_metrics`としてG、context D、tool L、context mL、SのLast Order／明示domain branch契約を分離する
- 同一親の「なんで？-DeFold-」を一実行へ直列化し、busy表示、同一fingerprint cache、generation更新、旧応答遮断、旧boundary一括交換を行う
- 「まとめる-Fold-」で中間表現を削除せず子孫nodeと内部edgeのcanvas描画を止め、縮小boundaryだけを投影する
- 縮小boundaryの「ひらく-DeFold-」で同じ子graphを再描画する。`unFold`は破壊的結合の予約語であり、この操作では実行しない
- FAM store通知をSession commit後へ移し、unit差替えをλとFoldLog edit recordへ同じ確定revisionから投影する
- Safari pane tabを固定幅scroll領域にせず、pane幅内へ縮約する
- decompose、edit、validate-edge、recursive-decomposeを`fold.log/0.1.0-alpha` / `oae.record/0.1.0-alpha`として生成し、secret redaction境界を保持する
- `ja-JP`を既定にし、schema key・URIを翻訳せず`en-US`表示へ切替できる

## Human GUI Test

1. Safariで`npm run dev`の`http://127.0.0.1:3000`を開く。Chromeは別の原因調査Issueが閉じるまで合格対象にしない。
2. 「降水確率は38%である。不安である。傘を持つ。」をfixtureで分解し、3つの独立∇φ nodeと1つのλ nodeが見えることを確認する。
3. 第1unitを「降水確率は68%である。」へ差替え、λが3行を保持することを確認する。
4. 第1unitを「降水確率は0%である。」へ差替え、影響nodeがstale表示になり、λが「再構成待ち」で旧3行を表示しないことを確認する。
5. Recordsで取消gate、affected Fold、`persistenceStatus: volatile`が読めることを確認する。
6. unitの「なんで？-DeFold-」を連打し、最初の1要求だけが走ること、`DeFold中…`表示になること、子graphが1つのatomic Fold boundary内へ生成されることを確認する。
7. 同じunitで再度「なんで？-DeFold-」を実行してnodeが増殖しないこと、unit編集後の再実行では旧boundaryごと新generationへ交換されることを確認する。
8. boundaryの「まとめる-Fold-」で子graphが一つの縮小node表示になり、「ひらく-DeFold-」で同じgeneration、revision、metricsの子graphへ戻ることを確認する。
9. Access Mapper / evidenceを開き、FAM IDとrevisionが読めることを確認する。
10. localeをEnglishへ切替え、機械可読key・URI・`unit_ref`が変化しないことを確認する。
11. 左paneに不要なtab scrollbarが再発せず、tab操作とpane本文scrollが分離していることを確認する。

## 完了に含めない境界

- Browser内FoldLog alphaはOAEレコードを生成できるが、永続OAE管理システムではない。
- IBDのvector graph DBとRDBへの二重永続化、取得、整合receiptは後続Issueである。
- 実RAG/World provider、VS Code Host、Sphere Hostの確認は#35へ混ぜない。
- この票の自動テストは、人間による配置、可読性、drag、操作感の確認を代替しない。
- Playwright等の別browser engine試験も、実Safariまたは実ChromeのHuman Testを代替しない。
