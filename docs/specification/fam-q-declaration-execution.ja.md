# FAM Qの宣言/実行分離とFold/DeFold/unFold

状態: `DESIGN-CORRECTIVE / IMPLEMENTATION-PENDING`

正本思想: [ZeroRoomLab-manifest `docs/theory/fam-q-declaration-execution-model.ja.md`](https://github.com/saitoomituru/ZeroRoomLab-manifest/blob/main/docs/theory/fam-q-declaration-execution-model.ja.md)(SphereOS Atlantis/ASTRO固有部分を含む包括版。本書はそのうち中立部分のみを転記する)

関連:
- [`fam-json-core.ja.md`](fam-json-core.ja.md)
- [`fold-boundary-runner.ja.md`](fold-boundary-runner.ja.md)
- [`fquery-selector-traversal-normalization.ja.md`](fquery-selector-traversal-normalization.ja.md)
- Issue #41(2026-09-13ブレスト)、reference実装候補: `refFAM/AtlantisCommons.refFAM.json`

## 目的

FAM base structure(`ψ/∇φ/λ/Q`)のうち`Q`だけが宣言(declaration)専用であることを固定し、実行(execution)は`Q(scope).method(args)`という統一呼び出しへ集約する。CoreはWorld観・backend製品名・特定protocolをこのcontractへ焼き込まない。

### 記号としてのψ/∇φ/λ/Q/⊥(2026-09-13追記)

これらが単語(`psi`/`lambda`/`bottom`等)ではなく単一unicode記号である理由: LLM tokenizerにとって、希少な単一記号は最小・安定したtoken単位になりやすく、既存語彙(英単語)が持つsubword分割の揺れや意味的connotationを引きずらない。これは表記の趣味ではなく、token境界を制御するための設計判断である。

## 1. `Q`(裸)は宣言専用、`ψ/∇φ/λ`は実行要素

```text
Q            宣言。どのpluginがこのscopeで有効かのbinding
Q(scope)     実行。有効なplugin群が束ねられたcallable handle
Q(scope).method(args)
             実行。そのplugin群のうちmethodを実際に叩く
```

`Q`に直接値を書く場合はpluginや registry参照等の宣言データのみを持つ。file取得やprompt実行のような**実行**は`ψ/∇φ/λ`側で`Q(scope).method`という呼び出し式(有効なJSON文字列key、値は呼び出し引数)として表す。

```json
"∇φ": {
  "Q(self).file.fit": ["world/*.reffam.json"]
},
"Q": {
  "plugin": ["@fam/stndio"]
}
```

## 1.1 実行引数の関係性(AND/sequence/OR)

`ψ/∇φ/λ`の中で`prompt`のような実行primitiveへ複数の指示を渡す場合、指示同士の関係性によって形を変える。

```text
[]配列          = バラさず並列AND。順序もOR分岐もない独立した制約の並び
                  "Q(this).prompt": ["制約A", "制約B", "制約C"]

{sequence:[...]} = 順序依存。ステップの並びが結果を左右する
                  "Q(this).prompt.sequence": { "steps": ["まずX", "次にY", "それも無ければZ"], "order": "strict" }

{or:[...]}       = 分岐。どちらが適用されるかはcontextに依存し、両方が同時に唯一の答えにはならない
                  "Q(this).prompt.or": { "branches": ["解釈A", "解釈B"], "condition": "..." }

バラして独立∇φ   = 各項目が独立にfold/処理できるなら、配列ではなく別々の∇φ nodeへ分離する
```

reference実装候補: `refFAM/git/mission-receipt-or-reality-artifact.reffam.json`(OR)、`refFAM/os/manifest-first-resolution.reffam.json`(sequence)、他多数(AND配列)。

## 2. `Q(scope)`のtree-scoped解決

`scope`は`self / this / this.parent / this.fold`のいずれかを取る。

```text
Q(this)         現在node自身が宣言したQ
Q(this.parent)  親nodeのQ
Q(this.fold)    別refFAM文書として開かれた包含FoldのQ
Q(self)         このFAMファイル/FAM.json単位のroot Q
```

解決順序: `Q(this) > Q(this.parent) > Q(this.fold) > Q(self)`。

- callable/chainableである点はjQueryの`$()`に相当する
- 継承・上書きの規則はVueの`provide()`/`inject()`に相当するtree-scoped(木構造範囲限定)であり、jQueryの`$.fn.foo = fn`のようなグローバル変異は採用しない
- 宣言しないnodeはこのchainを継承する。宣言したnodeは、そのfieldだけをshallow overrideする(deep-mergeしない、配列も丸ごと差し替える)。override箇所は意図的な差分点を可視化するためのものであり、暗黙のmerge/silent rewriteは行わない

`fold`は[`fquery-selector-traversal-normalization.ja.md`](fquery-selector-traversal-normalization.ja.md)が定義する`self/this/parent/children/prev/next/before/after`に次ぐ拡張primitive候補として追加する。同doc本体への正式merge(節番号付与)は別途行う。

## 3. 実行primitiveの名前空間はscopeのQ.pluginが決める

`Q(scope)`で呼べるmethod名はCore固定enumではなく、そのscopeへ宣言された`Q.plugin`が何を提供するかで決まる。

```text
Q.plugin: ["@fam/stndio"]              → Q(scope).file.fit(pattern) が呼べる
Q.plugin: [..., "@fam/whisper-*"]      → Q(scope).voice(streamOrWav) が呼べる
Q.plugin: [..., "@fam/*-llm-adapter"]  → Q(scope).prompt(text) が呼べる
```

Coreは「pluginが存在するか」だけを宣言的に確認する(Core責務)。「そのpluginが実行時に実際に機能する状態か」(例: 外部接続が実際に確立しているか)はplugin自身の実行時責務であり、Coreはここへ踏み込まない。

### 3.1 既存Core ABIとの対応(2026-09-13調査)

この`Q(scope).method(args)`呼び出しは、ゼロから実装するものではなく、`packages/core/src/types.ts`の`CapabilityInvocation`/`CapabilityResult`と`packages/plugin-sdk`の`PluginManifest`/`PluginRegistry`という既存ABIへ変換して実装できる見通しが立っている。

```text
Q(scope).method(args)
  ↓ 変換
CapabilityInvocation { capability: "method名(dot-namespace)", input: args, profileBindings: [scope解決結果] }
  ↓ PluginRegistry.invoke()
CapabilityResult { pluginStatus, value, candidate, reason, ... }
```

`capability`文字列は既にdot-namespace実例(`plugins/gemini`の`"fam.decompose"`)を持つため、`file.fit`/`unFold.pict`という命名はこの既存規約とそのまま整合する。`profileBindings`は`Q.plugin`宣言のtree-scoped解決結果を運ぶ器として転用できる。実装で新規に書く必要があるのは主に「`Q(this.fold)`のtree-walk解決アルゴリズム」と「`Q.plugin`宣言配列から`PluginRegistry.register()`への実際の紐付けコード」であり、Capability invocation ABI自体は再利用できる。

## 4. Fold / DeFold / unFold

```text
Fold    可逆・presentation。別refFAM/FAM文書を取り寄せて結合する
          例: Q(self).file.fit(pattern)
DeFold  可逆・局所編集。既存Foldを開いて再展開する。破壊しない
unFold  不可逆・生成。モデルに新規の何かを合成させる
          例: Q(scope).unFold.<method>(input)
```

Fold/DeFoldは「既存のものを取り寄せる/開き直す」操作で可逆、unFoldは「新規に生成する」操作で不可逆という区別を持つ。

## 5. 戻り値は常にFAM

`Q(scope).method(args)`の戻り値は、methodが何であっても常にFAM形式である(jQueryの全メソッドが`jQuery`オブジェクトを返しchainできるのと同型)。生のバイト列・生テキスト・生例外を直接露出しない。取得したFAMは、そのまま別の`Q(...)`呼び出しの入力scopeとして渡せる。

reject/blocked時にこの契約をどう保つかは、2026-09-13の実装調査で解消済み。`packages/core/src/types.ts`の`CapabilityResult`(`pluginStatus?: "resolved" | "rejected"`、`transportStatus`、`outputStatus?`、`candidate?`、`reason?`)が既に「例外を投げず、rejectでも構造化状態とlosslessなcandidateを保持する」という契約を実装済みである。`Q(scope).method(args)`の戻り値契約は、この既存`CapabilityResult`形状を土台にすればよく、新規のstatus markerを発明する必要はない。

残るUNKNOWNは、`CapabilityResult.value`が型として`unknown`のままであり、それが常にFAM形状であることをTypeScript型として強制していない点。refFAMの`Q(scope).method`記法を`CapabilityInvocation`/`PluginRegistry.invoke()`へ変換するadapter層を書く際に、`value`をFAM型へ絞り込む作業が必要になる。

**2026-09-13訂正**: `packages/plugin-sdk/test/q-compiler.test.ts`で実証した結果、`candidate`保持は`pluginStatus:"rejected"`(`transportStatus:"failed"`経路)では**保持されない**——`evaluator.ts`のこの分岐は`reason`と構造化`lastOrder`(`code:"FQUERY-PLUGIN-REJECTED"`)のみを返す。`candidate`保持は`outputStatus:"profile-nonconformant"`(transportは成功したがprofile不適合)という別軸の契約である。「reject/blocked時も例外を投げず構造化状態を返す」契約自体は実証済みだが、「rejectでもcandidateを保持する」は誤りだったので訂正する。

## 6. モデル/実行系の選択をCoreへ焼き込まない

`Q(scope).prompt(text)`等が実際にどのモデル・どの実行系実装で処理されるかを、Coreへ固定・焼き込みしない。`Q.plugin`宣言とそのbindingがFAM構造体側で解決する。

外部(FAM JSON文書の外)からFQueryを呼ぶ場合も、内部のnode間呼び出しと同一の記法を用いる。

```text
Q(FAMスコープ参照 or refFAM).prompt("自然言語input")
```

FQueryの外部API(呼び出し側から見た入口)とFAM文書内部のnode間呼び出しは、同一記法`Q(scope).method(args)`へ統一される。

## 7. `⊥`(Last Order)とOAE記録(2026-09-13追記、Issue #50由来)

### 背景

ψ/∇φ/λの3軸だけでFoldを再帰的に辿ると、無限/循環参照は構造的に必然発生する(奇数次元的な特異点、詳細はZeroRoomLab-manifest `docs/theory/infoton-engineering.ja.md` 6.1節参照)。これを「防ぐ」のではなく、**どこで・なぜ探索を打ち切ったかを記録して非破壊的に停止する**、というのが`⊥`の役割。`⊥`はmanifest `docs/theory/infoton-engineering.ja.md` 第4節が既に定義している概念(「⊥を返せることが工学であるための否定射程になる」)であり、Core `ControlStatus`の`"bottom"`とも対応する。今回はこれをrefFAMの`Q`語彙自体、およびOAE記録側へ正式に橋渡しする。

### `Q.⊥`の形状

Core既存の`LastOrder`(`{code, reason, requestedNext, resumeWhen}`、`packages/core/src/types.ts`)をそのまま再利用する。新しい打ち切り語彙を独自発明しない。

```json
"Q": {
  "⊥": {
    "code": "FQUERY-FOLD-CYCLE-DETECTED",
    "reason": "スプリッターが無関係なdomainへ流れたため他の枝をlast-orderした",
    "requestedNext": "select-another-branch-or-widen-scope",
    "resumeWhen": "explicit-scope-widening"
  }
}
```

### 発火条件

- fold-chain解決(`this.fold`等)で循環参照を検出した場合
- スプリッターが分解結果を無関係に見えるdomainへ流し込んだ場合、その時点で他の兄弟枝へ`⊥`を発行する(枝を削除せず、非ゼロサムで保持したまま「これ以上進めない」と明示する)
- `QueryPolicy.limits`(maxDepth/maxNodes/timeoutMs)超過時(Core既存`checkLimits()`と同型)

### OAE記録

`⊥`が発火した事実は、`packages/plugin-sdk`の`OaeConstraintEvaluationReceipt`と同じ設計思想(Coreはdomain固有の成立条件を裁定せず、参照束縛と確定可能性だけを保持する)に沿った、fold last-order専用のOAE receipt型として記録する。Core本体(`packages/core/src/types.ts`)への型追加は不要で、plugin-sdk層のadapter実装で足りる(`IMPLEMENTATION-PENDING`)。

## Non-goals

- SphereOS Atlantis/ASTRO固有の責務分界、Fold7G固有vocabularyをこの中立docへ含めること(→ manifest正本を参照)
- `Q(scope)`のmethod名をCore側でenum固定すること
- reject/blocked時の戻り値schemaを本書だけで確定させること(未確定のまま次Issueへ持ち越す)
