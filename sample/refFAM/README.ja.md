# refFAM 最小サンプル

状態: `[SAMPLE]` `[NON-CANONICAL]` `[DRIFT-EXAMPLE / ANTI-PATTERN]`

**2026-09-13追記**: `commons-sphere-basic.reffam.json`の`g_boundary_method`は、G軸(`fold-boundary-runner.ja.md`が定義する、FAM文書間参照の交差回数=Fold-on-Fold nesting depth)へ直接「G>=5はmetaphysical」という存在論的境界を貼り付けている。これはIssue #41が明示的に禁じる`local decomposition depth != Fold G slot`の実例(nesting depthを意味的スコープ判定へ横流ししている)であり、実装ドリフトの原因の一つとして特定された。G7〜G1という意味的スコープレジストリを書きたい場合は、このnesting depth軸ではなく`refFAM/AtlantisCommons.refFAM.json`(Fold7Gレジストリの正しい参照実装候補)を参照する。本fileは反面教師として残し、G境界の問い方自体(fact-freeな方法論)を示す目的では引き続き有効だが、G軸の値そのものを存在論境界の閾値として使う設計は複製しないこと。

このdirectoryは、`sample/`直下のFAM Topology sample（sample1〜3、selector/traversal正規化の例）とは別目的で、**refFAM（fact-freeな定規・問い方・分類法）の最小形状を示す例**を置く。

## `commons-sphere-basic.reffam.json`

目的: FQuery/IBD/Sphere系が使う **G軸（Fold-on-Fold nesting depth）** を跨いだ解釈で、物理世界scopeと形而上学scopeをどこで切り分けるかという**問い方**を示す最小サンプル。

G軸の定義はIBD `docs/architecture/context-dimension-os-and-ibdsdk.ja.md`（`Fold nesting G — Fold containerを包むnesting depth`）とFQuery Issue #37（`G: Fold-on-Fold boundaryを跨いだGravity深度`）を参照する。本sampleはこのG軸の上に「G=5をmundane/metaphysical切り分けの慣習境界とする」という一つの解釈例を置く。

## 必ず確認する2点（重要なので2回書く）

1. **これは唯一の正本ではない。** 利用者は自分自身のref.fam.jsonを自由に作成してよい。本fileを複製・改変・破棄してよく、承認や互換性証明を必要としない。
2. **FQuery Coreは、どのrefFAMが来てもその内容が正しいかを論じない。** `G=5`という境界値も、本fileが記述する分類方法も、Coreへハードコードされた意味論ではなく、このCommonsサンプル固有の慣習にすぎない。別のref.fam.jsonが別の境界値・別の分類法を採用しても、どちらが正しいかをCoreは裁定しない。

（重ねて: これは唯一の正本ではなく、Coreはrefファイルの正しさを裁定しない。）

## fact-free境界

`AGENTS.md`のrefFAM保存規則どおり、本fileは`fact`を含まない。観測された特定の霊・神格・出来事の実在主張は書かず、「G境界をどう問うか」「境界を跨いだ主張をどう保持するか」という**方法**だけを記述する。

個人の具体的な信仰実践（本記事の著者が持つ独自の信仰体系を含む）は、本Commonsサンプルの範囲外であり、必要な利用者が別途自分のref.fam.jsonへ書き込む。

## 出典

`ZeroRoomLab-manifest/note/narrative/情報子工学マガジン_FOLD本文.md` 7章「refFAMは信仰にも中立——好きな哲学を書き込んでいい」を参照する。同章は、refFAMがどの企業哲学・宗教的イデオロギーも優遇・排除しないこと、著者自身も独自の信仰実践をrefFAMへ実装していること（詳細は本Commonsサンプルの範囲外）を述べている。
