# CREDITS

FQueryのGUI設計にあたり、概念・体験の参考にした先行作品への謝辞です。

ここに挙げる作品からコード、asset、shader、画像、schemaを転用していません。platform、engine、言語、意味契約がいずれも異なるため転用は不可能であり、参考にしたのは「node editorとしてどう振る舞うべきか」という概念だけです。著作権上は完全に別物であり、各作品の権利は各作者に帰属します。

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
  - ChatGraphはWindows向けPyQtアプリでChatGPT／Pythonをengineとする。FQueryはVue 3／BaklavaJS上のPresentation層で、engineはFAM／Q（Proton.md semantic ABI）
  - FQueryではnode本体の中身をplugin rendererが供給し、`Ψ / ∇φ / λ / Q`の意味役割へ着地させる
  - 実行成功とλ satisfactionを分離する状態境界はFQuery固有

### Blender（Blender Foundation）

- https://www.blender.org/
- 参考にした概念:
  - node editor（Shader／Geometry Nodes）のcanvas操作、Add Node検索、group／frame／collapse
  - propertiesパネルによるnode設定とcanvasの分離
- Blenderのコード・UI asset・アイコンは使用していません。GPLコードの転用もありません。

## 背景理論・既存学術へのリスペクト

原初のFAM（FoldAccessMapper）の着想、Q／λ／∇φ／ψの意味軸、test case作成規格（world mismatch、lexical neighbor misbinding、責任抽象化の反転など）の材料として、以下の情報工学・認知科学・精神医学の既存研究を参照しました。

この一覧は「FAMがこれらを実装した」「これらがFAMを裏付けた」という主張ではありません。**工学的な思考モデルの材料として役立った**ことへの敬意の記録であり、同時に**既存科学・医学に新たな発見や訂正が出た場合にFAM側の仕様を修正するためのlog**です。後に否定・取り下げ・修正された研究も、思考モデルの形成に寄与した事実は変わらないので削除せず、その旨を追記します。

| # | 文献 | FAM／FQueryでの参照点 | 状態note |
|---|---|---|---|
| 1 | Vaswani, A. et al. (2017). *Attention is All You Need*. NIPS. | 意味空間における注意制御、系列処理の非再帰的最適化。∇φ（意味勾配）の圧縮観点 | — |
| 2 | Mikolov, T. et al. (2013). *Distributed Representations of Words and Phrases and their Compositionality*. NeurIPS. | 高次元ベクトル空間への意味投射。IBD側vector／store責務との境界設定 | — |
| 3 | Bengio, Y. (2017/2021). *The Consciousness Prior*. arXiv:1709.08568. | 潜在空間における意識的探索経路のFold的アプローチ | preprint |
| 4 | Ribeiro, M. T., Singh, S., & Guestrin, C. (2016). *"Why Should I Trust You?"*. KDD. | 決定の透明性と相互解釈可能性。FAMLog／receiptによる観測境界 | — |
| 5 | Schuld, M., Sinayskiy, I., & Petruccione, F. (2015). *An Introduction to Quantum Machine Learning*. Contemporary Physics 56(2). | 波動関数的意味探索の比喩。ψ（wave／trigger）命名の着想 | 比喩としての参照。量子計算の実装主張ではない |
| 6 | Bengio, Y., Courville, A., & Vincent, P. (2013). *Representation Learning: A Review and New Perspectives*. IEEE TPAMI 35(8). | 多層的特徴表現と意味空間の圧縮・展開（∇φ／将来のΔφ） | — |
| 7 | Jaeger, H. (2001). *Echo State Network*. GMD Report 148. | リザバー計算による高次元波形推論。Fold Compiler（#31）の参考 | — |
| 8 | Tishby, N., & Zaslavsky, N. (2015). *Deep Learning and the Information Bottleneck Principle*. arXiv:1503.02406. | 情報圧縮と展開を通じた説明可能性。lossless reader／loss receiptの設計動機 | preprint |
| 9 | Yang, Y., Feng, C., Shen, Y., & Tian, D. (2018). *FoldingNet: Point Cloud Auto-encoder via Deep Grid Deformation*. CVPR. | 「folding」操作による形状再構成。Fold命名の参照点 | — |
| 10 | Nguyen, M., & Wu, N. *Folding over Neural Networks*. arXiv. | NN構造を再帰的データ型として表現しfold／unfoldで形式化。recursive FAMNode契約の参考 | preprint |
| 11 | Ben Dror, A. et al. *Layer Folding: Neural Network Depth Reduction using Activation Linearization*. arXiv. | 連続線形層のfoldによる深さ削減。Fold→model蒸留（#31）の参考 | preprint |
| 12 | Matsumoto, T. (2022). *Addiction and Dopaminergic Reward Pathways: Understanding A10 Circuit Dysregulation in Psychiatric Disorders*. NCNP. | A10回路・報酬系異常と強化学習モデル。domination／dependency risk（#24 B-4）の材料 | 医学的主張はFAM仕様の正本ではない |
| 13 | NCNP (2023). *Amygdala Function in Working Memory and Self-Referential Reward Processing*. Journal of Neurological Research. | 扁桃体・短期記憶・自我報酬スイッチ。ψ granularity（#24 B-1）と観測costの材料 | 同上 |
| 14 | Yamada, H., & Sato, M. (2024). *The Role of the Cerebellum and Pituitary Network in Cognitive Processing*. Neuroscience Letters. | 小脳・脳下垂体を介した推論ネットワーク接続。parent Ψ_context／parallel Fold（#24 A-4）の材料 | 同上 |
| 15 | 小椋哲 (2021). 『医師を疲弊させない! 精神医療革命』. Medical Journal Press. | 医療現場の認知負荷軽減と情報整理。responsibility-abstraction-inversion（#20）の問題設定 | — |

### 運用規則

- 文献の追加・訂正はこのファイルへ追記し、FAM仕様への影響がある場合はIssueで`spec-revision`として扱う
- 参照した文献が後に否定・撤回された場合、行を削除せず「状態note」に撤回日・理由・FAM側の対応（仕様修正／影響なし）を記す
- 書誌情報の誤りは訂正する。訂正前の記述をcommit履歴に残す
- ここに載せた研究者・機関がFQuery／FAMを承認・推奨したことを意味しない

## 依存library

runtime dependencyのlicenseは各packageの`package.json`とlockfileを正本とします。BaklavaJS（MIT）はnode-editor surfaceとして通常dependencyで利用しています。

## 境界

- この謝辞は、各作者がFQueryを推奨・承認したことを意味しません
- 参考にした概念の記述は本repository作成者の理解であり、原作者の設計意図の正本ではありません
- 転用がないことの根拠は本repositoryのcommit履歴とsource treeです
