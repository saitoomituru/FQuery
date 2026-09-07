# Issue #35 Browser Playground引継ぎ票

状態: `AUTOMATED-PASS / HUMAN-GUI-PENDING`

対象revision: `7e37b71` 以降（実施時のHEADを記録すること）

## 自動検証済み

- decomposition FAMの各unitがstable `Q.unit_ref`、unit revision、親FAM revisionを持つ
- テスト用Basic Commons Access Mapper自体がrevision固定FAMであり、World/Astral/Element/unknown分類とTC2局所gateを注入する
- 初期placeholderから、分解後に `1 Ψ → N ∇φ → 1 λ` の独立nodeへ投影する
- 選択unitだけの差替えで兄弟unit、親FAM拡張field、旧revisionを保持する
- TC2の`38→68`はactive branchを保持し、`38→0`はfallbackを発明せず`needs-recomposition`としてstale λ出力を遮断する
- recursive Whyが別の子decomposition FAMを生成し、親unitの下へdepth付き子Foldを投影する
- decompose、edit、validate-edge、recursive-decomposeを`fold.log/0.1.0-alpha` / `oae.record/0.1.0-alpha`として生成し、secret redaction境界を保持する
- `ja-JP`を既定にし、schema key・URIを翻訳せず`en-US`表示へ切替できる

## Human GUI Test

1. `npm run dev`で`http://127.0.0.1:3000`を開く。
2. 「降水確率は38%である。不安である。傘を持つ。」をfixtureで分解し、3つの独立∇φ nodeと1つのλ nodeが見えることを確認する。
3. 第1unitを「降水確率は68%である。」へ差替え、λが3行を保持することを確認する。
4. 第1unitを「降水確率は0%である。」へ差替え、影響nodeがstale表示になり、λが「再構成待ち」で旧3行を表示しないことを確認する。
5. Recordsで取消gate、affected Fold、`persistenceStatus: volatile`が読めることを確認する。
6. unitの「Whyを再分解」で子Foldが生成され、階層paneでindentされることを確認する。
7. Access Mapper / evidenceを開き、FAM IDとrevisionが読めることを確認する。
8. localeをEnglishへ切替え、機械可読key・URI・`unit_ref`が変化しないことを確認する。

## 完了に含めない境界

- Browser内FoldLog alphaはOAEレコードを生成できるが、永続OAE管理システムではない。
- IBDのvector graph DBとRDBへの二重永続化、取得、整合receiptは後続Issueである。
- 実RAG/World provider、VS Code Host、Sphere Hostの確認は#35へ混ぜない。
- この票の自動テストは、人間による配置、可読性、drag、操作感の確認を代替しない。
