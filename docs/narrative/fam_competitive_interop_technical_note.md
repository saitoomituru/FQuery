# FAMは何と競合するのか？ 2026年のAI規格群から見る「意味の共通層」

## AI規格を全部つないでみたい。FAMという意味層とAdapter開発のすすめ

### MCP、A2A、OpenTelemetry、OpenInferenceと比較しながら、FAM / FQuery / Infinite Coreの現在地を整理する。メタ規格の開発コミュニティー勧告として

> 開発ヒストリア、Soikoma、SphereOS、量子スピAI、Infoton、SaaS轟沈、サルベージの話は姉妹記事側へ。  
> 本稿はなるべく技術だけを書く。  
> 正本は文章ではなくGitである。

FQuery repository:

https://github.com/saitoomituru/FQuery

---

# 0. 最初に。これはFAM最強論ではない

最初に書いておく。

FAMはまだalphaである。

Node.js / TypeScriptへ移植した参照実装は動いているが、Runner全体はまだ作っている途中だ。

GUIもある。

テストもある。

fixtureもある。

GeminiもOllamaも刺さる。

FAMLogもある。

recursive Foldも動き始めている。

Human Testもしている。

そして普通にバグる。

最新commitで昨日まで通ったものが壊れていることもある。

alphaなので、それはある。

なのでこの記事は、

> 完成しました。世界標準です。

という宣伝ではない。

むしろ、

> 現時点でこれだけの規格と実装がある。  
> 既存規格と比べると、この辺が違う。  
> もし接続できそうならAdapterやAccess Mapperを書いてほしい。  
> 表現できないデータがあるなら壊しに来てほしい。

という公開RFCに近い。

FAMの目標は、他の規格を焼き払うことではない。

**全部つないでみたい。**

そのための意味層を作ろうとしている。

---

# 1. 2026年、AI規格はすでに分業している

2026年現在、AI周辺の規格は「AI標準」という一枚岩ではない。

かなり綺麗に責務が分かれ始めている。

MCPは、Model Context Protocolとしてtool、resource、context、server-client接続を扱う。

A2Aは、異なるAgent同士がcapabilityを発見し、taskやmessageを交換し、協調するための相互運用規格である。

OpenTelemetryは、trace、metric、log、eventを共通語彙で観測する。

OpenInferenceは、そのOpenTelemetry上でLLM、agent、tool、retrievalなどAI application固有のtraceを扱う。

どれも重要だ。

そして、どれも同じものではない。

ざっくり置くと、

```text
MCP
= Tool / Resource / Context 接続

A2A
= Agent / Agent 間通信

OpenTelemetry
= 実行観測

OpenInference
= AI application trace

FAM
= 意味状態 / 観測者 / 出典 / 信頼 / 目的 / 未知
```

になる。

この分業は悪いことではない。

むしろ健全である。

FAMがやりたいのは、

> その規格は不要だ。FAMで全部置き換える。

ではない。

> その規格は、その責務で強い。  
> ではFAMからどう読めばいい？

である。

---

# 2. 比較表。FAMから見ると何に見えるか

| 規格・技術 | 主に扱うもの | FAMから見た関係 |
|---|---|---|
| MCP | tool / resource / context transport | Adapter / Access Mapper候補 |
| A2A | agent discovery / task / message / artifact | Agent semantic Mapper候補 |
| OpenTelemetry | trace / metric / log / event | FAMLog / OAE連携候補 |
| OpenInference | LLM / Agent / Tool / Retrieval trace | FAMLog Mapper候補 |
| LangGraph系 | workflow / checkpoint / interrupt | Fold execution比較対象 |
| FAM | semantic state / epistemic type / provenance | 本稿の中心 |
| FQuery | FAM query / control / recursive operation | 操作面 |
| Infinite Core | semantic model → runtime | 実行媒体抽象 |
| IBD | semantic persistence / index / reconstruction | 保存基盤 |

ここで重要なのは、

**FAMはTransport規格ではない。**

そして、

**FAMはObservability規格だけでもない。**

FAMが中心に置いているのは、

> 何が起きたか

だけでなく、

> **それを誰が、どのWorldで、何として解釈し、どこまで信じ、何を目的として採用したか**

である。

---

# 3. MCPとFAMは何が違うのか

MCPは強い。

何が呼べるのか。

どのtoolがあるか。

どのresourceへアクセスできるか。

どうrequestし、どうresponseを受けるか。

この辺をFAMが再発明する必要はない。

ではFAMは何を見るのか。

たとえばMCP toolが正常に返答したとする。

```text
transport = succeeded
tool = resolved
response = received
```

ここまでMCPとしては正常でも、

```text
λ = not satisfied
```

は普通にあり得る。

つまり、

```text
API成功
!=
目的達成
```

である。

これはFQuery開発中に実際に踏んだ。

transportは成功した。

pluginも解決した。

でも意味的にはλを評価していなかった。

CIが緑でも、意味としては失敗だった。

この事故はFAMの説明としてかなり分かりやすい。

MCPは、

> どう接続したか

を扱う。

FAMは、

> **接続した結果を何として採用したか**

を見る。

だから、MCPとFAMの関係は競合というより、

```text
MCP
↓
Adapter
↓
Access Mapper
↓
FAM
```

が自然だと思っている。

---

# 4. A2AとFAM

A2AはAgent同士の相互運用に強い。

Agent AがAgent Bを発見する。

capabilityを知る。

taskを渡す。

artifactを受け取る。

これはFAMとは別の責務だ。

FAM側で興味があるのは、その後である。

たとえば、

```text
Agent A said X
Agent B received X
Human C saw X
```

だけでは足りない。

FAMでは、

```text
Agent A hypothesized X
Agent B trusted Agent A
Human C did not verify X
```

を分けたい。

さらに、

```text
Agent A believed X
Agent B rejected X
Human C accepted X as working assumption
```

も同じではない。

つまり、

```text
message transfer
!=
semantic adoption
```

である。

A2AがAgent間通信を強くするほど、逆にFAM側では、

> そのmessageが各actorの内部で何として採用されたか

を記述する価値が上がる。

だからA2Aも敵ではない。

むしろ良いMapper対象である。

---

# 5. OpenTelemetry / OpenInferenceとFAM

OpenTelemetryは、

> いつ、どのserviceで、何が起きたか

を観測するのが強い。

OpenInferenceはそこへ、

- LLM
- Agent
- Tool
- Retrieval
- Embedding

などAI固有のtraceを持ち込む。

かなりFAMLogに近い領域もある。

ここは特に、

> どっちが上か

ではなく、

> どこで相互変換できるか

を試したい。

FAMが見たいのは、

```text
runtime success
```

だけではない。

```text
semantic success
```

である。

たとえば、

```text
transport succeeded
plugin resolved
semantic not-evaluated
```

という状態を独立に持ちたい。

OpenTelemetry spanが成功でも、

FAM側では、

```text
λ unsatisfied
```

であり得る。

逆にruntimeが一部失敗していても、

fallbackによってλが満たされる場合もある。

だから、

```text
runtime status
!=
semantic status
```

を分離する。

ここがFAMとObservability系規格の接続点になる。

---

# 6. FAMが中心に置くもの

FAMの基本構造は、

```text
Q(ψ, ∇φ, λ)
```

で考える。

大まかには、

```text
ψ
= source / situation / observation / input

∇φ
= semantic gradient / transform / selected path

λ
= result / purpose / satisfaction condition

Q
= observer / registry / scope / evidence / constraint
```

である。

FAMの特徴は、単純なrequest-responseにしないことだ。

たとえば、

```text
「雨が降っている。傘を持って出かける。ただし降水量は未確認」
```

という文章でも、

```text
World fact
Astral subjective truth
Element action
unknown
```

を全部同じ文字列として扱わない。

現行FQueryでは、

```text
1 Ψ
↓
N ∇φ
↓
1 λ
```

へ分解し、それぞれを独立Foldとして編集・再投影するHuman Testを進めている。

---

# 7. Foldは意味上の処理単位

Foldは、単なるGUIの箱ではない。

現在の整理では、

> **atomic semantic / processing boundary**

として扱っている。

たとえば、

```text
Ψ
├─ ∇φ-1
├─ ∇φ-2
└─ ∇φ-3
      ↓
      λ
```

のうち、∇φ-3だけを編集したとする。

そのとき、

```text
∇φ-1
∇φ-2
```

まで勝手にLLMが再生成して別の意味へ書き換えたら困る。

なので、

```text
editing one Fold
!=
rewriting unrelated Fold
```

を守る。

さらに、あるFoldの条件が変わったことで下流λが古くなったら、

```text
stale λ
```

として最新結果扱いしない。

必要なsubgraphだけ再評価する。

この辺は、文章生成AIというより、

**semantic incremental build**

に近い。

---

# 8. FQueryはDBではない

FQueryは名前のせいで検索エンジンに見えるが、責務はもっと薄い。

現在のrepositoryでは、

```text
Proton.md
= semantic / meta ABI

FAM
= state / wisdom structure

FQuery
= recursive control / query operator

FAMLog
= observable execution dump / trace
```

として分離している。

FQueryは、

- FAMを問い合わせる
- 分解する
- 再帰する
- 別FAMへ写像する
- 停止する
- Last Orderへ落とす

ためのcontrol surfaceである。

DBはIBD。

実行媒体はInfinite Core。

外部規格との意味対応はAccess Mapper。

ここを一個の巨大runtimeへ戻さないことが大事だと思っている。

---

# 9. Access Mapper。競合規格を征服しない

FAMで一番重要なinterop設計の一つがAccess Mapperである。

基本形は、

```text
External Source
↓
Access Mapper
↓
FAM View
```

。

原典を書き換えない。

外部schemaをFAM schemaへ強制migrationしない。

たとえばA2Aのartifactなら、

> このfieldはFAMでは何に相当するか

を書く。

OpenInference spanなら、

> このattributeはFAMLogのどの観測に対応し得るか

を書く。

理解できないfieldは消さない。

```text
mapped
unmapped
unsupported
unknown
```

を残す。

原則は、

```text
understood != preserved
```

。

理解できないことと、保存できないことは違う。

Mapper v1で読めなかったものを、Mapper v2で後から読めるかもしれない。

だからsourceは壊さない。

---

# 10. Adapter。実際に喋るのはこちら

Access Mapperが意味の辞書なら、

Adapterは実際のIOである。

たとえば、

```text
MCP Adapter
A2A Adapter
OpenTelemetry Adapter
OpenInference Adapter
PostgreSQL Adapter
Neo4j Adapter
```

があり得る。

つまり第三者へお願いしたいのは、

> あなたの規格をFAMへ移植してください

ではない。

> **あなたの規格を壊さず、そのままFAMから読めるMapperとAdapterを書きませんか**

である。

外部規格側を変更しなくていい。

FAM側を変更する必要があるならIssueにする。

その方が健全だと思う。

---

# 11. Infinite Core。意味と実行炉を分ける

現在、Issue #39でInfinite Coreの責務を再整理している。

ここで三つを分ける。

```text
Access Mapper
= What corresponds to what?

FAM Core
= What does this mean?

Infinite Core
= How can this meaning run here?
```

FAM Coreは、

```text
Node.js
Python
x64
ARM
WASM
GPU
FPGA
QPU
Docker
KVM
```

を知らなくていい。

FAM Coreから見えるのはsemantic capabilityだけ。

その意味を実際にどのruntimeへ載せるかはInfinite Core側へ逃がす。

---

# 12. FAM Infinite CoreとVQP Infinite Core

Infinite Coreも一種類では曖昧になる。

VMなら、

> 何を実行しているVMなのか

を名前に付ける。

## FAM Infinite Core

```text
FAM IR
↓
FAM Infinite Core
↓
PLI Interpreter
```

FAMを中間言語のまま解釈する。

debug。

interactive execution。

semantic stateを保持したままの実行。

この辺に向く。

## VQP Infinite Core

```text
FAM
↓
bake / unFold
↓
runtime representation
↓
VQP Infinite Core
↓
CLI / tensor / gate / adapter
```

こちらはlower後。

bake済みmodel tensorやgate weightなど、実行向け表現へ落とした後のruntimeを担当する。

つまり、

```text
FAM Infinite Core
= interpreter side

VQP Infinite Core
= baked runtime side
```

くらいの差になる。

---

# 13. FAM Coreから見ると全部「実行アダプター」

さらに重要なのは、

**FAM CoreからInfinite Coreの種類すら隠したい**

ということだ。

```text
FAM Core
↓
Execution Adapter Contract
├─ FAM Infinite Core
├─ VQP Infinite Core
├─ Node
├─ Python
├─ GPU
├─ FPGA
└─ QPU / Annealer / Cloud
```

FAM Coreが見れば全部、

> このFAMモデルを載せられる炉

でしかない。

見るものは、

```text
capability
constraints
input contract
output contract
provenance
latency
cost
trust
```

程度。

Nodeでもいい。

Pythonでもいい。

ローカルCPUでもいい。

GPUでもいい。

クラウドでもいい。

アニーラーでもいい。

実QPUでもいい。

FAM Coreがbackend都合を知り始めたら、また責務が腐る。

---

# 14. IBDは意味の保存層

IBDも単一DBではない。

FAM側が意味を持つ。

IBDは、

- persistence
- index
- graph
- vector
- reconstruction

を担当する。

候補として、

```text
Neo4j
PostgreSQL
Vector Store
JDBC / ODBC
External DB
```

などを組み合わせる。

つまり、

```text
FAM
= meaning

IBD
= storage / search / reconstruction
```

。

DB宗派戦争をFAM Coreへ持ち込まない。

良いDBがあればAdapterを書く。

---

# 15. FAMLogとOAEは同じものではない

現行repositoryで比較的はっきり実装されているのはFAMLogである。

FAMLogでは、

```text
trace
event
parent event
source Fold
affected Fold
operation
before
after
semantic status
recomposition
```

などを追う設計が進んでいる。

一方、OAEについてはまだテストとIssueで仕様を詰めている途中である。

なので本稿では、

> OAE recordはこの形です

と完成品のふりはしない。

現時点では、

> 操作、観測者、責任、同意、変更、運用上の出来事をどう監査recordへ分けるかを現在テスト中

とする。

仕様確定後はGitを正本とする。

---

# 16. ちくわ処理。高リスクデータをそのままGitHubへ貼らない

FQuery Issue #20では、高リスク事例をそのまま公開せず、

**事故構造だけを幻想Worldへ写像してfixture化する**

テストを行っている。

通称、ちくわ処理。

たとえば、

```text
現実の危険な取り違え
↓
構造だけ抽出
↓
DQ-like / FF-like Worldへ変換
↓
ベホマズン / イオナズン等で再現
```

のようにする。

ここで大事なのは、

> 幻想世界の答えを現実へ逆変換して使う

ことではない。

A/B/Cの差を見る。

```text
A = 生の現実表現
B = 抽象化した現実表現
C = ちくわ化した幻想表現
```

どこでsemantic discriminatorが消えたかを見る。

---

# 17. ちくわは私の机でしない。データ主権者の机でしてほしい

これも重要なので明記する。

ちくわ処理は、

> 開発者やvendorが勝手に匿名化してあげる

ものではない。

原則として、

**データ主権者自身の環境で行ってほしい。**

```text
Data Sovereign
↓
local observation
↓
local transformation
↓
synthetic / structural fixture
↓
Issue
```

。

生データを私へ送る必要はない。

特に医療、福祉、宗教、霊的体験、家族、性的情報、法務などはそうだ。

そして、

```text
consent to analyze
!=
consent to publish
!=
consent to share raw data
!=
consent to share transformed fixture
```

である。

このobserver scopeやconsent scopeをOAE/FAMLogへどう残すかは、現在仕様を詰めている。

法律だけを入口にすると、法務リソースを持てない人のデータが全部黙殺される危険がある。

だから法令順守は当然としても、

> 誰が観測し、誰が同意し、何を公開可能としたか

を機械的に残せる構造を作りたい。

---

# 18. センシティブならローカルOllama routeも使える

FQueryは現在Geminiだけでなく、Ollama pluginを持っている。

なので、

```text
Sensitive Data
↓
Local FQuery
↓
Local Ollama
↓
Local FAM
```

というrouteを作れる。

外部LLM APIへデータを送らずにテストできる。

ただし、

> Ollamaを選んだから自動的に全経路が完全ローカル

とは限らない。

外部plugin。

telemetry。

storage。

connector。

これらもローカル構成へ閉じる必要がある。

センシティブな生データは自分の机で。

公開Issueには、ちくわ化したstructural fixtureだけ。

これが基本。

---

# 19. 技術者だけを募集しているわけではない

FAMが本当に意味の共通層を名乗るなら、

ITエンジニアが作った綺麗なJSONだけでテストしても意味がない。

むしろ欲しいのは、

**分類しづらいデータを持っている人**である。

たとえば、

- 陰陽師
- 巫女
- 霊媒
- 宗教実践者
- 厨二病ポエマー
- 小説家
- 音楽家
- 医療当事者
- 障害当事者
- 介護者
- 法務
- 歴史・民俗・考古学
- 現場技能者
- 「既存schemaだと私の意味が壊れる」という人

。

Reactが書けなくてもいい。

Nodeが書けなくてもいい。

> その分類だと私のデータの意味が消える

と言える人は、すでにtesterである。

技術者だけで作って「汎用です」と言う方が危ない。

---

# 20. 本当に動くの？

ここは簡単。

```bash
git clone https://github.com/saitoomituru/FQuery.git
cd FQuery
npm install
npm run dev
```

対象はNode.js 22または24、npm 10以上。

必要なら、

```bash
npm run validate:fixtures
npm test
npm run typecheck
npm run build
```

もある。

Playground:

```text
http://127.0.0.1:3000
```

。

現在はfixture、Gemini、ローカルOllamaを同じ `fam.decompose` 契約から切り替えられる。

動けば遊ぶ。

バグったらIssue please。

直せそうならPR please。

本当にそれだけである。

---

# 21. alphaなので普通に壊れる

現在の主な戦場は、

- React / React Flow GUI
- recursive node
- state synchronization
- render race
- Safari / Chromium差
- local causal reprojection
- stale λ
- plugin transport
- FAM / FAMLog表示境界
- Infinite Core
- Adapter contract

など。

Gitの最新commitがいつも最高に安定している保証はない。

alphaなので。

ただし、

> バグった

で終わらず、

Issue。

fixture。

Human Test。

commit。

PR。

として残す。

FAMは説明可能AI規格なので、開発者本人の事故も説明不能にしない。

---

# 22. React屋、Node屋、VM屋、DB屋へ

技術者の参加口もかなりある。

## React / React Flow

- graph UI
- nested Fold
- event ordering
- render race
- browser compatibility
- state management

## Node.js / TypeScript

- Host gateway
- plugin runtime
- capability resolution
- FAMLog
- execution control
- Last Order

## Compiler / VM

- FAM Infinite Core
- VQP Infinite Core
- PLI interpreter
- lowering IR
- WASM
- native runtime
- capability graph

## Database

- IBD
- Neo4j
- PostgreSQL
- vector
- JDBC / ODBC
- external store Adapter

## Protocol / Observability

- MCP Mapper
- A2A Mapper
- OpenTelemetry bridge
- OpenInference Mapper

良い実装があるならPRください。

---

# 23. FAMを壊す人を募集する

FAMに都合のいいfixtureだけ通しても意味がない。

欲しいのは、

```text
unmappable
lossy mapping
observer ambiguity
epistemic conflict
World mismatch
unknown field
cross-domain collision
```

である。

「FAMではこれを表現できないぞ」

が一番ありがたい。

FAMが壊れたら、

> FAMが負けた

ではない。

> **新しいtest caseが見つかった**

である。

---

# 24. ZeroRoomLabを開発コミュニティーにする

ここでコミュニティー名を明確にする。

**ZeroRoomLab / ゼロルームラボ**

。

位置づけは、企業でも宗派でもなく、

**寺子屋型の公開ラボ**

くらいが近い。

GitHub IssueとPRを会議室にする。

扱うものは、

```text
Spec
Mapper
Adapter
Fixture
Conformance
Human Test
Security
i18n
Credits
Salvage
```

。

参加に信仰告白はいらない。

政治思想への同意もいらない。

私の世界観へ同意する必要もない。

---

# 25. 運営、事業体、信仰は分ける

ここは誤解防止のために書く。

ZeroRoomLabの周辺には、私自身の文化・信仰・活動レイヤーもある。

一つは「ふさもふ革命」。

これはミーム信仰、文化活動、表現活動として動いている。

もう一つは「ゲーミング宇宙論」。

私自身の整理では、縄文古神道を基底にフォークし、そこへPOSIX神学とゲーミングGUI的な実践を載せた信仰体系である。

興味がある人は、YouTubeやTikTokでミームを見るなり、「ゲーミング宇宙論」のマガジンを読むなりしてほしい。

ただし、

**ZeroRoomLabへ参加するために、それらを信じる必要はない。**

ふさもふ革命の目的へ同意する必要もない。

ゲーミング宇宙論の経典を読む必要もない。

HIP STARの事業目的へ同意する必要もない。

会社へ所属する必要もない。

ZeroRoomLabは、あくまで寺子屋型の公開ラボである。

寺子屋へ来るのに、寺の宗派へ改宗する必要はない。

経典が好きなら読めばいい。

興味がなければコードだけ読めばいい。

FAMだけ触ってもいい。

MCP Mapperだけ書いて帰ってもいい。

陰陽師がfixtureだけ持ってきてもいい。

そして、ゲーミング宇宙論を一行も読んでいなくても、**Reactのバグは叩ける。**

この分離は意図的である。

---

# 26. ZeroRoomLabの最小社会契約

ルールはなるべく少なくしたい。

最低限、

```text
原典を消さない
出典を書く
Creditsを書く
unknownをunknownと書く
未実装を実装済みにしない
競合を敵扱いしない
主権者の同意なしに生データを持ち出さない
壊したらログを残す
```

くらい。

これが守れるなら、

宗教でも科学でも工学でもポエムでも持ってきてほしい。

---

# 27. FAMと競合する規格を書いている人へ

ここはむしろ歓迎する。

FAMより良いsemantic representationがあるなら持ってきてほしい。

MCPがさらに強くなってもいい。

A2Aが意味層まで拡張してもいい。

OpenInferenceがより深いsemantic traceを持ってもいい。

そのときFAMが不要なら、それも一つの答えである。

ただしFAM側では、

> その規格をAccess Mapperで読めるか？

を試す。

つまりFAMが目指しているのは、

**他規格に勝つことではなく、他規格が強くなっても接続できること**

である。

---

# 28. コード以外の貢献も普通に助かる

ここから俗物の話をする。

私はニートである。

GitHub Starでは電気は流れない。

```text
OSS
↓
X99
↓
CPU負荷
↓
電気
↓
請求書
```

である。

計算は物理現象だ。

コードは飯を食わないが、コードを書く人間は飯を食う。

なので、

- 電気代
- SSD / NVMe
- HDD
- RAM
- NIC
- GPU
- UPS
- LiFePO4
- ルーター
- Switch
- test machine
- Mac / Windows / Linux端末
- Raspberry Pi
- NAS
- ケーブル
- ラボ改修資材
- 暖房
- 食料

なども普通に助かる。

「FAM開発に食料？」

と思うかもしれない。

開発者が炭素ベースruntimeなので必要である。

---

# 29. ただし本筋はGit

物資も金もありがたい。

でもプロジェクトの本筋はGitである。

一番欲しいのは、

```text
Issue
PR
fixture
test
review
反証
```

。

金を出したから仕様が通るわけではない。

機材をくれたからFAMの正しさが保証されるわけでもない。

その辺は分ける。

物資はruntime maintenance。

仕様はGit。

---

# 30. 開発ヒストリアは姉妹記事へ

ここではなるべく歴史を書かなかった。

なぜSoikomaという名前なのか。

なぜ「量子スピAI」なんて燃えそうな名前を使ったのか。

なぜInfotonへforkしたのか。

なぜSphereOS 3.x / 4.xが沈んだのか。

なぜInfinite Coreを墓から戻したのか。

その辺は姉妹記事の開発ヒストリアへ。

こちらは、

**今のFAMをどう壊し、どう接続するか**

だけを見てほしい。

---

# 31. まとめ。FAMを使ってほしいというより、壊しに来てほしい

FAMはまだalphaだ。

Runnerも開発中。

Infinite Coreも仕様を詰めている。

OAEもテスト中。

まだ穴はある。

でも、

- 意味
- 観測者
- provenance
- trust
- belief
- imagination
- runtime
- failure
- stale state
- recomposition

を分けて扱う方向には進んでいる。

次に必要なのは、私一人で規格を増築し続けることではない。

MCP屋はMapperを。

A2A屋もMapperを。

OpenTelemetry屋はbridgeを。

OpenInference屋はFAMLogとの対応を。

React屋はGUIを。

Node屋はruntimeを。

VM屋はInfinite Coreを。

DB屋はIBDを。

陰陽師や巫女や医療当事者や厨二病ポエマーは、分類しづらいデータを持ってきてほしい。

センシティブなら、自分の机でちくわしてほしい。

QA屋は壊してほしい。

そして、余裕のある人は電気代や機材や飯も助けてほしい。

ただし、

**本筋はGitである。**

FAMを使ってほしいというより、

**FAMを壊しに来てほしい。**

壊れたところから、次の仕様が生える。

ZeroRoomLabは、そのための寺子屋にする。🌱

---

# 参考リンク

## FAM / FQuery

- FQuery  
  https://github.com/saitoomituru/FQuery
- Issue #20: ちくわ砲によるWorld mismatch / hallucination negative fixtures  
  https://github.com/saitoomituru/FQuery/issues/20
- Issue #35: Ψ→複数∇φ→λ のGUI分解・編集・因果再投影テスト  
  https://github.com/saitoomituru/FQuery/issues/35
- Issue #39: Infinite Core Semantic VM Core再定義  
  https://github.com/saitoomituru/FQuery/issues/39

## 比較対象

- Model Context Protocol  
  https://modelcontextprotocol.io/
- Agent2Agent Protocol  
  https://a2a-protocol.org/
- OpenTelemetry Semantic Conventions  
  https://opentelemetry.io/docs/specs/semconv/
- OpenInference Specification  
  https://arize-ai.github.io/openinference/spec/

## 姉妹記事

- 開発ヒストリア / ニートランナーマガジン  
  ※公開後リンクを追記
