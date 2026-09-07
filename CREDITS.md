# CREDITS

本ファイルは、FQuery / FAM の設計過程で概念的・工学的な示唆を受け、**現在も現行設計・test case・説明上の参照として扱う作品・研究・実装**への謝辞と、参照範囲の記録です。

歴史的に設計形成へ寄与した一方、現在は再確認困難、撤回、理論更新、参照用途終了などにより**現行test case生成や定期見直しの入力から外した参照**は [`HISTORICAL_CREDITS.md`](./HISTORICAL_CREDITS.md) に分離して保持します。

ここに挙げる作品から、コード、asset、shader、画像、schema 等の転用は行っていません。参考にしたのは主として「node editorとしてどう振る舞うべきか」「複雑系の故障モードをどのように観測・分解するか」といった概念・体験・思考モデルです。各作品・研究の権利はそれぞれの作者・権利者に帰属します。

また、本repositoryでは現在検索可能な情報だけを正本とはしません。参照当時に確認した一次資料・現物・公開文献の記録を保持し、後年の撤回、改題、掲載先変更、理論更新、検索不能化、追試による支持強化は履歴として扱います。AI / RAG による補完情報は一次資料より下位の補助情報として扱います。

## Creditsの二層運用

FQuery / FAMでは、**参照元の寿命とtest caseの寿命を分離**します。

- `CREDITS.md`: active provenance。現在も設計説明、motif、test case生成・見直しの参照として利用するもの
- `HISTORICAL_CREDITS.md`: historical provenance。設計形成への寄与は保持するが、現行test case生成や定期見直しの必須入力から外したもの

historicalへの移動は「誤り」「失敗」の烙印ではありません。再確認不能、撤回、理論更新、別理論への統合、研究停止、参照用途終了など、**現在の参照状態が変化したこと**を表します。

逆に、後年の追試、査読、再現、正式出版等によって支持や書誌状態が強くなった場合は `strengthened` / `revived` として履歴を残し、必要に応じてactive側へ再昇格できます。

## Special Thanks — GUI概念の参考

### ChatGraph（uynet）

- 作者: uynet
- 配布: https://uynet.booth.pm/
- 解説記事: https://qiita.com/uynet/items/eb0ee91800cfc1ca4bc1
- 参考にした概念:
  - node editorが全画面の主題であり、付録ではないこと
  - node本体に入力欄と出力結果が同居し、inspectorと双方向に結びつくこと
  - 任意の実行単位（ChatGraphではPythonコードのstdout）をsocketで繋ぐ汎用visual scriptingとしての構え
  - 複数nodeを1 nodeへ畳むmodule、循環参照の検出、JSONでの保存・読み込み
- FQueryとの違い:
  - ChatGraphはWindows向けPyQtアプリでChatGPT / Pythonをengineとする
  - 現行FQuery GUIはReact / React Flow上のPresentation層。Vue 3 / BaklavaJS backendは Issue #36 で交換し撤去した（2026-09-08）
  - engineはFAM / Q（Proton.md semantic ABI）側にあり、GUI frameworkは交換可能なbackendとして扱う
  - FQueryではnode本体の中身をplugin rendererが供給し、`Ψ / ∇φ / λ / Q` の意味役割へ着地させる
  - 実行成功と λ satisfaction を分離する状態境界はFQuery固有

### Blender（Blender Foundation）

- https://www.blender.org/
- 参考にした概念:
  - node editor（Shader / Geometry Nodes）のcanvas操作、Add Node検索、group / frame / collapse
  - propertiesパネルによるnode設定とcanvasの分離
- Blenderのコード・UI asset・アイコンは使用していません。GPLコードの転用もありません。

## 背景理論・既存学術へのリスペクト

原初のFAM（FoldAccessMapper）の着想、Q / λ / ∇φ / ψ の意味軸、test case作成規格（world mismatch、lexical neighbor misbinding、責任抽象化の反転など）の材料として、以下の情報工学・認知科学・精神医学の既存研究を参照しました。

この一覧は「FAMがこれらを実装した」「これらがFAMを裏付けた」という主張ではありません。**工学的な思考モデルやstress test設計の材料として役立った**ことへの敬意の記録であり、同時に**既存科学・医学に新たな発見や訂正が出た場合にFAM側の仕様を修正するためのlog**です。

特に臨床・社会構造に関する文献は、人間とAIの実装同一性を主張するためではなく、**人間という長期間実運用された複雑系で観測される認知負荷・情報分断・責任集中・依存・判断劣化などの故障モードを、AI / 情報システム向けの負荷テストへ抽象化して転写するためのreference failure corpus**として参照しています。

表中の `#` は履歴追跡のためのstable reference IDです。historical側へ移動しても欠番を詰めません。

| # | 文献 | FAM / FQueryでの参照点 | 状態note |
|---|---|---|---|
| 1 | Vaswani, A. et al. (2017). *Attention is All You Need*. NIPS. | 意味空間における注意制御、系列処理の非再帰的最適化。∇φ（意味勾配）の圧縮観点 | active |
| 2 | Mikolov, T. et al. (2013). *Distributed Representations of Words and Phrases and their Compositionality*. NeurIPS. | 高次元ベクトル空間への意味投射。IBD側vector / store責務との境界設定 | active |
| 3 | Bengio, Y. (2017/2021). *The Consciousness Prior*. arXiv:1709.08568. | 潜在空間における意識的探索経路のFold的アプローチ | active / preprint |
| 4 | Ribeiro, M. T., Singh, S., & Guestrin, C. (2016). *"Why Should I Trust You?"*. KDD. | 決定の透明性と相互解釈可能性。FAMLog / receiptによる観測境界 | active |
| 5 | Schuld, M., Sinayskiy, I., & Petruccione, F. (2015). *An Introduction to Quantum Machine Learning*. Contemporary Physics 56(2). | 波動関数的意味探索の比喩。ψ（wave / trigger）命名の着想 | active。比喩・命名上の参照。FAM / FQueryが量子計算、量子スピントロニクス、その他の量子ハードウェアを実装しているという主張ではない |
| 6 | Bengio, Y., Courville, A., & Vincent, P. (2013). *Representation Learning: A Review and New Perspectives*. IEEE TPAMI 35(8). | 多層的特徴表現と意味空間の圧縮・展開（∇φ / 将来のΔφ） | active |
| 7 | Jaeger, H. (2001). *Echo State Network*. GMD Report 148. | リザバー計算による高次元波形推論。Fold Compiler（#31）の参考。写像としての再投影、vector DB friendlyなメタ構造の検討材料 | active |
| 8 | Tishby, N., & Zaslavsky, N. (2015). *Deep Learning and the Information Bottleneck Principle*. arXiv:1503.02406. | 情報圧縮と展開を通じた説明可能性。lossless reader / loss receiptの設計動機 | active / preprint |
| 9 | Yang, Y., Feng, C., Shen, Y., & Tian, D. (2018). *FoldingNet: Point Cloud Auto-encoder via Deep Grid Deformation*. CVPR. | 「folding」操作による形状再構成。Fold命名の参照点。メタ構造と操作性の両立を考える際の数論ブリッジとして参照 | active。実装責務の同一性は主張しない |
| 10 | Nguyen, M., & Wu, N. (2022). *Folding over Neural Networks*. arXiv:2207.01090. | NN構造を再帰的データ型として表現しfold / unfoldで形式化。recursive FAMNode契約の参考 | active / preprint |
| 11 | Ben Dror, A. et al. (2022). *Layer Folding: Neural Network Depth Reduction using Activation Linearization*. BMVC. | 連続線形層のfoldによる深さ削減。Fold→model蒸留（#31）の参考 | strengthened。参照当時はpreprint。後にBMVC 2022として出版状態がより明確になったため書誌情報を更新。FAM側の参照点に変更なし |
| 15 | 小椋哲 (2021). 『医師を疲弊させない! 精神医療革命』. 幻冬舎メディアコンサルティング. | 医療現場における認知負荷、情報分断、責任集中、制度上の要求と実務可能性の乖離を、人間社会構造のstress testとして参照。`responsibility-abstraction-inversion`（#20）、silo化、説明責任と実務負荷の衝突など、制度工学系test caseの問題設定に寄与 | active。旧 `Medical Journal Press` 表記はAI / RAGによる自動転記時の誤りと判断し、手元の現物と書誌に基づき訂正。FAMが医療制度そのものを再現・実装するという主張ではない |

## 人間臨床・社会構造からAI負荷テストへの転写

FAM / FQueryで臨床・精神医学・社会制度の知見を参照する目的は、人間の脳や社会制度をAI内部にそのまま再現することではありません。

参照対象は主に、以下のような**複雑系で観測された破綻パターン**です。

- 認知負荷・注意資源枯渇・判断疲労
- 報酬偏り・依存・自己参照の歪み
- 情報サイロ化・文脈断絶
- 責任集中・権限と責任の不一致
- 説明責任の過剰化による本来業務の圧迫
- 制度上は正しいが現場では実行不能となる状態

これらをFAM / FQueryでは、context overload、routing failure、observer loss、responsibility abstraction inversion、normative leakage、silent override、lineage loss 等のAI / 情報システム向けtest caseへ抽象化して利用します。

すなわち、医学をAIの正当化根拠にするのではなく、**医学・臨床・社会制度で観測された故障モードをAIの試験治具へ転写する**という位置づけです。

## 運用規則

- 文献の追加・訂正はこのファイルへ追記し、FAM仕様への影響がある場合はIssueで`spec-revision`として扱う
- 現行のtest case生成・定期見直しに使わなくなった参照は削除せず `HISTORICAL_CREDITS.md` へ移す
- historical化は価値判断ではなく参照状態の遷移として記録する
- 後年の追試・査読・再現・正式出版等で支持が強くなった場合は `strengthened` / `revived` を記録し、必要に応じてactive側へ戻す
- 書誌情報の誤りは訂正する。訂正前の記述はcommit履歴に残す
- 参照当時に確認した一次資料・現物の記録を、後年の検索結果だけで上書きしない
- AI / RAGによる補完情報は一次資料・現物・確定書誌より下位の補助情報として扱う
- ここに載せた研究者・機関がFQuery / FAMを承認・推奨したことを意味しない

## 依存library

runtime dependencyのlicenseは各packageの`package.json`とlockfileを正本とします。

現行GUIではReact Flow（`@xyflow/react`、MIT）をnode-editor surfaceとして通常dependencyで利用しています。BaklavaJS（MIT）は Issue #36 での交換前に利用していたhistorical依存であり、`THIRD_PARTY_NOTICES.md`に記録を残します。依存関係・licenseの正本はpackage metadataとlockfileに置きます。

## 境界

- この謝辞は、各作者・研究者・機関がFQuery / FAMを推奨・承認したことを意味しません
- 参考にした概念の記述は本repository作成者の理解であり、原作者・研究者の設計意図や学説の正本ではありません
- コード・asset・schema等の転用がないことの技術的な確認根拠は、本repositoryのcommit履歴とsource treeです