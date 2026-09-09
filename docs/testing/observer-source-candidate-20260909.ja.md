# 公開テキストObserver候補 2026-09-09

状態: `SOURCE-OBSERVED / HUMAN-TEST-NOT-RUN / RULE-NOT-EVALUABLE`

## 目的

固定fixtureだけでなく、人間が読んで意味のある公開短文を使い、FQueryの分類事故、World混同、
flat fan-outをHumanが修正できるか観測する。これは自動test結果でも、Human合格receiptでもない。

## Source selection receipt

```yaml
source_pool_ref: https://www.nintendo.com/jp/topics/list
source_owner: Nintendo
observed_at: 2026-09-09T09:15:46+09:00
source_retrieval_order: earlier-in-same-session
selection_scope: response内で抽出できた先頭12件の公開見出し
selection_method: deterministic-pseudo-random
seed_ref: fquery-commit://17d96ae
seed_integer: 25007790
selected_index_zero_based: 6
subject_ref: web-source://nintendo/topics/list/selected/6
subject_revision_ref: observation://20260909T091546+0900
observer_ref: observer://openai/codex/current-session
observer_domain_ref: domain://fquery/source-candidate-selection
rule_ref: rule://fquery/human-context-structure-review/draft
rule_revision_ref: revision://unresolved
candidate_record_ref: oae://fquery/source-candidate/20260909/nintendo-6
candidate_record_revision_ref: revision://fquery/source-candidate/20260909/1
evaluator_ref: evaluator://openai/codex/current-session
evaluator_revision_ref: fquery-commit://17d96ae
record_integrity: valid
rule_conformance: not-evaluable
observer_verdict: usable-candidate
evidence_refs:
  - https://www.nintendo.com/jp/topics/list
issue_codes:
  - human-context-rule-revision-unresolved
  - human-verdict-not-observed
human_test_status: not-run
```

選ばれた見出しは、任天堂公式Topics一覧の「Hello! インディー」から始まり、架空の熱帯の島々を
水上飛行機で巡る冒険を紹介する短文である。著作物本文は複製せず、Human Test時は上記URLとその時点の
source revision／取得範囲を参照する。一覧は更新され得るため、このreceiptは将来の同一index再取得を
同一byte sourceとして保証しない。

## 分解仮説（Human verdictではない）

```text
World: real/publication
  Nintendoが公式Topicsとして紹介した

World: real/product
  game作品が紹介対象として存在するというpublisher claim

World: fictional/work
  水上飛行機、熱帯の島々、冒険は作品内Worldを記述する

relation
  real publication -> describes -> fictional world
```

「公式sourceで公開された」という現実Eventと、「作品内で冒険する」というfictional Eventを
同じWorld factへ潰さないことが観測焦点である。正しいtopology、context一致、作品設定の正確さは
Humanまたは別Observerがrule refを確定した後に判定し、Codexの分解仮説をglobal truthへ昇格しない。

## 後続source cohort

- game／配給会社の公式news
- 映画会社の公式作品情報
- 監督／開発者interview
- 権利と個人情報を扱える範囲のSNS短文
- 日本語、英語、codeが同一文脈に混在する技術文

各sourceはproviderの人気順を「random」と呼ばず、候補pool、取得時刻、selection seed／index、URL、
Observer、rule refをreceiptへ残す。Humanが`matched`または`not-matched`を付けても、その判定は
指定rule下のOAE拘束成立であり、FQueryが唯一の正解として採用しない。
