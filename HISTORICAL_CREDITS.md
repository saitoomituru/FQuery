# HISTORICAL_CREDITS

本ファイルは、FQuery / FAM の設計形成に歴史的に寄与したものの、現在は**現行test case生成・定期見直しの必須入力から外した参照**への謝辞とprovenance logです。

ここに移されたことは、その研究・作品が「誤り」「失敗」「価値が低い」と判断されたことを意味しません。参照元の寿命とtest caseの寿命を分離し、現在の検索可能性・学説的位置づけ・書誌状態・設計上の参照用途を時間軸付きで記録するための層です。

現行で参照中のものは [`CREDITS.md`](./CREDITS.md) を参照してください。

## 状態語彙

- `historical-reference`: 設計形成への寄与を保持するが、現行test case生成・定期見直しから外した
- `superseded`: 後続理論・知見・実装へ参照点が移った
- `unavailable`: 参照当時は確認したが、現在は一次資料への到達性が低い／再確認困難
- `withdrawn`: 取り下げ・撤回等が確認された
- `unverified-currently`: 現時点で再確認できないが、存在しなかったと断定しない
- `revived`: 後年の追試・再評価等で参照価値が復活した
- `strengthened`: 査読、正式出版、追試、再現等で参照状態が強くなった

`revived` / `strengthened` になった参照は、必要に応じて `CREDITS.md` へ再昇格できます。

## Historical references

表中の `#` は `CREDITS.md` から継承したstable reference IDです。履歴追跡のため番号を詰めません。

| # | 文献 | 当時のFAM / FQueryでの参照点 | 現在の状態 | 現行test caseでの扱い |
|---|---|---|---|---|
| 12 | Matsumoto, T. (2022). *Addiction and Dopaminergic Reward Pathways: Understanding A10 Circuit Dysregulation in Psychiatric Disorders*. NCNP. | A10回路・報酬系異常と強化学習モデル。domination / dependency risk（#24 B-4）や、注意資源・報酬偏りをstress testへ転写する際の材料 | `historical-reference` / `unverified-currently`。参照当時に原文を画面確認。後年の公開状態・書誌・学説的位置づけの変化により現行検索で安定して再確認できないため履歴層へ移動 | 現行test case生成の必須参照にはしない。医学的主張をFAM仕様の正本としない |
| 13 | NCNP (2023). *Amygdala Function in Working Memory and Self-Referential Reward Processing*. Journal of Neurological Research. | 扁桃体・短期記憶・自己参照報酬を、人間側の認知負荷・観測cost・ψ granularity（#24 B-1）の故障モードとして参照。Sphere-aae等の軽量MoE / vector cache設計を考える際の人間側reference failure model | `historical-reference` / `unverified-currently`。参照当時に原文を画面確認。現在は公開状態・書誌・理論的位置づけを安定して再確認できないため履歴層へ移動 | 現行fixtureのオラクルや必須ケース生成入力にはしない。人間脳とAIの実装同一性は主張しない |
| 14 | Yamada, H., & Sato, M. (2024). *The Role of the Cerebellum and Pituitary Network in Cognitive Processing*. Neuroscience Letters. | 小脳・脳下垂体を介した推論ネットワーク接続を、parent Ψ_context / parallel Fold（#24 A-4）や劣化性vector cacheの構造検討における人間側reference modelとして参照 | `historical-reference` / `unverified-currently`。参照当時に原文を画面確認。現在は公開状態・書誌・学説的位置づけを安定して再確認できないため履歴層へ移動 | 現行test case生成の必須参照にはしない。protein neural networkとAIの同一実装を主張しない |

## この層の目的

このファイルは「古い説の墓場」ではありません。

FQuery / FAMでは、研究や知識の状態が時間とともに変化することを前提にしています。ある参照が現在検索できない、別理論へ吸収された、研究が止まった、撤回された、といった理由で現行test cycleから外れても、**当時その参照が設計形成へ与えた影響はprovenanceとして保持**します。

逆に、当時はpreprint・限定的根拠だった研究が後に査読・追試・再現で支持を強める場合もあります。その場合は履歴を残したまま `strengthened` / `revived` として再評価し、必要であればactive creditsへ戻します。

これにより、現在の検索ランキングや制度的なアクセス性だけで過去の知識形成を上書きせず、同時に不安定な参照元を現行CI・fixture・人間レビューの固定費として抱え続けないことを目指します。

## 運用規則

- historical化は削除ではなく参照状態の遷移として扱う
- historical参照は通常のtest case生成・定期見直し・release blockerの必須入力にしない
- fixtureの正本はschema、status軸、failure class、FAMLog等の工学契約に置く
- historical参照から抽出されたmotifが契約語彙だけで自立している場合、そのmotif自体はactiveなtest caseとして残してよい
- 一次資料の再発見、正式出版、追試、再現、再評価があった場合は状態を追記する
- `revived` / `strengthened` と判断した場合、必要に応じて `CREDITS.md` へ再昇格する
- 書誌・状態の訂正前記述はcommit履歴に残す
- 現在検索不能であることだけを根拠に「存在しなかった」と断定しない
- ここに載せた研究者・機関がFQuery / FAMを承認・推奨したことを意味しない
