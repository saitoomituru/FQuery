# Human Gateの位置決定規約

状態: `[CANONICAL]`
制定日: 2026-09-11
契機: Core正規化（Issue #43）の単独CLI Human Testを、GUI/IBD統合後のHuman Testへ統合するUser決定

## 背景

`docs/testing/browser-automation.ja.md`が定めるとおり、Browser検証は既に次の順で積み上がっている。

```text
CHROMIUM-CI-PASS
  -> CHROME-AUTOMATED-PASS
  -> SAFARI-MCP-AUTOMATED-PASS
  -> HUMAN-TEST-*
```

つまりHumanの手前に、agentが実行できるあらゆる自動検証（unit / typecheck / CI Chromium / 実Chrome自動操作 / Safari MCP自動観測）を積み切ることが既定である。Humanは「agentが検証不能な最後の一段」だけを引き受ける。

Issue #43はこの列に乗らない孤立したHuman Gate（`npm run inspect:topology`のJSON出力をHumanが目視するだけ）を持っていた。CoreのTopology IR出力はGUIも実providerも経由しないため、Humanが判断できる実体験（配置、操作感、実際の分解結果）が無く、Human資源をGUI/IBD統合前の中間表現へ消費するだけになっていた。これを是正する。

## 規約

Human Gateとして有効な位置は次の3種のみとする。それ以外の「Coreの中間出力をHumanが目視する」形の単独ゲートは新設しない。

1. **GUI check** — agentがbrowser MCP（Safari MCP／実Chrome自動操作／CI Chromium）で自動検証を積み切った後、Userが実画面・実操作感を確認する位置
2. **仕様制定（spec establishment）** — マニフェスト／各プロジェクトのnarrative・note・Issue・milestoneを突き合わせても解決できない設計判断が必要な位置
3. **仕様矛盾解決（spec contradiction resolution）** — 複数の正本文書・Issue間で相反する記述が見つかり、agentが一方を選ぶと形而上学的目的（存在意義・設計原則）を実装都合で上書きしてしまう位置

## Core-only実装のHuman Gate扱い

selector正規化、Topology IR、storage contractのようにGUIを経由しないCore実装は、次を満たせば`AUTOMATED-VERIFIED`として先へ進めてよい。単独のHuman Gateで停止しない。

```text
必須:
  - 自動test green
  - typecheck green
  - CI green
  - 受入条件（Issueの受入条件チェックリスト）を自動検証で確認可能

不要:
  - CoreのJSON/CLI出力だけをHumanが目視するgate
```

このCore-only作業のHuman確認事項は破棄せず、後続のGUI/IBD統合Human Testへ引き継ぐ。引き継いだ確認事項は統合後のHuman Test文書内に節として残す。

## 自動解決とMAGI監査

実装・仕様判断で曖昧さが出た場合:

- マニフェストのnarrative、各リポジトリのnote／Issue／milestoneから一意に解決できる場合は、agentが自動解決してよい
- 自動解決する場合、[Atlantis-MAGISDK 0.2.1](../../../ZeroRoomLab-manifest/docs/theory/atlantis-magi-sdk-0.2.1.ja.md)の三Position（Maxwell／Uriel／Raphael）に相当する問いを自己点検する
  - Maxwell: 実装都合で他branch・他仮説・原初の形而上学的目的を焼却していないか
  - Uriel: 参照した根拠（commit／Issue／note）を追跡可能な形で残しているか
  - Raphael: 異なる関心事（Core契約／GUI都合／provider都合）を無断で同一棚へmergeしていないか
- 解決内容と根拠refをcommit・issue commentへ残す（=Interpretation OAEとして記録する）
- 大きな矛盾があり、実装都合（vibe coding的な帳尻合わせ）が形而上学的目的をオーバーライドしかねない場合は、agentが勝手に決めず、対象IssueまたはMilestoneへ論点を書き、Human Gateへfall backする

## 適用例: Issue #43

- CoreのTopology IR実装は自動test green・CI green・受入条件確認済みのため`AUTOMATED-VERIFIED`として完了扱いとし、単独Human Gateでは止めない
- sample1/2/3のHuman確認項目（`issue-43-human-acceptance.ja.md`）は破棄せず、#35/#37/#5系のGUI Human Testへ引き継ぐ
- 実際のHuman Gateは、IBD #3/#4のstorage adapterがGUIへ接続され、agentがbrowser MCPで自動検証した後に発生する
