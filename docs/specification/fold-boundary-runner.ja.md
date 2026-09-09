# atomic Fold reference RunnerとG/D/L/mL/S構造座標

状態: `DESIGN-CORRECTIVE / LEGACY-NESTED-IMPLEMENTATION / HUMAN-RETEST-PENDING`

正本思想: [ZeroRoomLab-manifest `f27903a`](https://github.com/saitoomituru/ZeroRoomLab-manifest/blob/f27903abd3e2c69732dfcbec91d948b1d3801808/docs/theory/fam-infoton-reference-boundary.ja.md)

Machine contract: [`fam-reference-boundary.ja.md`](fam-reference-boundary.ja.md)

## 目的

分解した意味単位を互いに無関係なGUI部品として放出せず、一括解決すべき境界をatomic Foldとして扱う。ただしFoldを**同一FAM JSON内のhidden child graph / group**としてcanonical所有しない。

Fold boundaryは、独立したchild FAM identityへの参照境界である。

```text
resolution_mode = atomic-resolution
dispatch_mode   = single-processing-unit
ownership       = independent-fam-reference
```

概念形:

```text
FAM-A
  ψ
  ├─ node-1
  ├─ Fold-X -> fam_ref: FAM-X
  └─ node-3
  λ

FAM-X
  ψ
  ├─ ∇φ-X1
  ├─ ∇φ-X2
  └─ ∇φ-X3
  λ
  Q
```

RunnerはFold-Xへ到達すると`fam_ref`をresolveし、FAM-Xを一つの処理単位として実行する。

同じ親Foldの実行中は同一boundaryへの再帰分解要求を重複受理しない。親revision、入力、provider、model、active refFAM等が変わった再実行ではgenerationを進め、旧projectionと新projectionを区別する。中止済みgenerationの遅延応答を新revisionへ接続しない。

## Fold操作語彙

日本語UIを正本とし、次の3操作を混同しない。

| 操作 | 日本語UI | semantic boundary | 用途 |
|---|---|---|---|
| `DeFold` | `なんで？-DeFold-` / `ひらく-DeFold-` | 保持 | `fam_ref`をresolveし、参照先FAMの内部projectionを開く |
| `Fold` | `まとめる-Fold-` | 保持 | 参照先FAMを削除せず内部projectionだけを畳む |
| `unFold` | 現時点でUI未実装 | 破壊し得る | FAM境界をbake / merge / replaceし、中間表現を破棄し得る |

### DeFold

`DeFold`はchild FAMをparent JSONへinline copyする操作ではない。

GUIが複数FAMを一つのviewportへ合成表示する。

```text
FAM-A view
  └─ Fold-X
       └─ projected FAM-X view
            └─ Fold-Y
                 └─ projected FAM-Y view
```

`なんで？-DeFold-`は、参照先FAMを新規生成する場合と、既存`fam_ref`を開く場合を区別する。新規分解でboundaryが発見された場合、独立FAM extraction candidateを作り、parentへrefを戻す。

暗黙Context、refFAM、Access Mapper、corpus、tool、Observer、ruleを実際に使った場合はreceiptから辿れるようにする。receiptが存在しない理由を後から生成せず、`resolution-provenance-unavailable`を返す。

### Fold

`まとめる-Fold-`はpresentation accelerationである。

次を削除しない。

- child FAM identity
- child revision
- child Q / provenance / OAE / FAMLog
- parentの`fam_ref`
- G/D/L/mL/Sのsemantic measurement source

canvasから参照先FAMの内部projectionだけを外し、boundary nodeを縮小表示する。

### unFold

`unFold`は独立FAM境界そのものを破壊し得る予約操作である。既存Atlantis/Manifest文書で記された「変換前の表現を破棄し生成結果へ置換する系」と同じ概念を継承する。

`Fold` / `DeFold`を暗黙に`unFold`へ昇格させない。

## FAM extraction

同一FAM内の`∇φ` / subtree / Foldを複数semantic consumerが必要とした場合、同一document内shared node / DAGへ拡張しない。

```text
legacy / non-canonical

Fold-A ─┐
        ├─ shared X
Fold-B ─┘

canonical candidate

Fold-A -> ref ─┐
               ├─ FAM-X
Fold-B -> ref ─┘
```

複数参照は純粋な叡智の証明ではなく、まず経験価値の可搬性signalである。独立FAM identityへ抽出した後、内容がfact / 合意 / 業務 / 個別経験を含むなら通常FAM、fact-freeな問い・方法・定規ならrefFAM candidateとして扱える。

具体的な抽出手順は[`../architecture/fam-reference-extraction.ja.md`](../architecture/fam-reference-extraction.ja.md)を参照する。

## `fold_boundary.boundary_metrics` namespace

短縮表示はG/D/L/mL/Sを使う。機械契約ではFold boundaryの`boundary_metrics`配下へ閉じる。

| 軸 | 名称 | canonical measurement source |
|---|---|---|
| G | Gravity | FAM reference pathの深度 |
| D | Dimension | 対象FAM内で明示された一意なcontext dimension数 |
| L | Layer | API、adapter、tool等のtechnology/tool chain長と接続状態 |
| mL | meta Layer | 判断・解釈を含むcontext/meta chain長 |
| S | Socket/SDK | 専用node pluginと出口adapterによる外部接続契約 |

```json
{
  "boundary_metrics": {
    "G": { "max": 0, "median": 0, "min": 0 },
    "D": 0,
    "L": {
      "max": 0,
      "median": 0,
      "min": 0,
      "continuity": "not-declared",
      "broken_route_refs": []
    },
    "mL": { "max": 0, "median": 0, "min": 0 },
    "direct_child_count": 0,
    "S": {
      "socket_present": false,
      "adapter_ref": null,
      "on_missing": "last-order"
    }
  }
}
```

このJSONはprofile例でありFAM Core base必須fieldではない。

### G

GはReact Flowの`parentId`、DOM nesting、canvas group数ではなく、semanticなFAM reference pathを測る。

```text
FAM-A -> FAM-B -> FAM-C

CをAから開いたview
  G path depth = 2
```

同じFAMへ複数pathが存在する場合、`max / median / min`を返せる。cycleは正常な深度として数えず、reference topology error / unresolvedとして分離する。

### D

Dは対象FAM内の一意な`context_dimension_ref`数。直下node数をDへ混ぜず、必要なら`direct_child_count`へ分離する。

### L

Lはtechnology / tool chain。API、adapter、device、plugin、external service等の実行chainを測る。

必須routeが切れていれば`continuity=disconnected`。

### mL

mLは判断、解釈、context transition等のmeta chain。Lの実行成功と混同しない。

### S

Sは外部接続契約。必要なplugin / adapter / socketが無い場合、使えたことにせずLast Orderを返す。

## 境界判定

1. 独立FAM reference boundaryを一つ跨ぐごとに、そのsemantic pathのGを`+1`する。
2. Dは現在resolveしたFAM内の一意なcontext dimensionを数える。
3. Lは宣言済みtechnology/tool edgeだけを測る。
4. mLは判断・解釈edgeだけを測る。
5. 欠落ref、未解決revision、cycle、dangling edgeを成功routeへ数えない。
6. Sはactive profileが要求するsocket/adapterを満たした場合だけ成立とする。
7. renderer内のhidden node数やgroup nestingからG/D/L/mLを逆算しない。

S不成立なら`FOLD-SOCKET-MISSING`、必須L route切断なら`FOLD-TOOL-CHAIN-DISCONNECTED`等のLast Orderを元経路へ返す。

これは想像や信仰・信頼による別branch継続そのものを禁止しない。明示的に別domainへ分け、`spiritual-trust` / `imaginative-hypothesis` / `not-verified` / `verification-not-applicable` / `verification-prohibited`等をactive profileで表現できる。ただし元のLを検証済みに偽装しない。

完全検証が射程外またはそのWorldのrule上不適切な場合、`verification-prohibited` / `not-evaluable`を正規状態として保持できる。FQuery Core自身が特定宗教・科学・法・ゲームWorldの成立条件をhard-codeしない。

## semantic reference topologyとexecution topology

```text
semantic reference topology != execution topology
```

semantic側は、どのFAMがどのFAMをどの関係で参照するかを保持する。

execution側は、そのFAMをどのmodel、human、API、device、processへdispatchするかを決める。

```text
semantic
FAM-A
  ├─ ref -> FAM-B
  └─ ref -> FAM-C

execution example
FAM-B -> local model
FAM-C -> remote tool
```

B/Cを並列実行してもsemantic parentageをroot siblingへ書き換えない。

同じFAM-Xを複数consumerが参照する場合、executionではcache / dedupe / memoize / parallel dispatchできるが、それを理由にFAM-Xを複製した別semantic identityへ変えない。

parent-child referenceはexecution dependency、shared refはjoin / shared dependency、OAE requiredはvalidation barrier等へ投影できる。

resource選択とscheduler policyはCoreへ固定しない。Execution Adapter、Host、active authority/refFAM等が決める。

## 複数topology / Observer

同一sourceに複数semantic reference topologyが成立し得る。

```text
branch A
  FAM-A -> FAM-X

branch B
  FAM-A -> FAM-Y -> FAM-X
```

一つのbranchを採用しても他branchをglobal falseとして削除しない。生成者、Observer、active refFAM、rule、revision、adoption scopeを保持する。

G/D/L/mL/Sは構造座標であり、正解度、権威、成果量ではない。深いほど偉い、nodeが多いほど成功、ref countが多いほど真理、というmetricにしない。

## fact / refFAM境界

refFAMは共有fact tableではなく、旧AQC SchemerをFAMへ統合したmethod / metaphysical schemaである。

```text
りんごが落ちた
  -> normal FAM + Q evidence

なぜ？
他でも試す？
条件を変える？
別Observerでも追試する？
  -> refFAM candidate
```

factを扱う通常FAMではprofileに応じてQへevidence取得方法、Observer、対象revision、verifier、hash receipt等を持てる。

## #35 legacy実装との境界

#35で実装されたnested Fold UIには、同一session graph内にboundaryとchild nodeを保持するlegacy pathがある。

これはHuman Testで得た重要な試作実績だが、現行参照境界契約のcanonical ownershipとは一致しない。

migrationは次の順で行う。

```text
legacy nested subtree
  -> detect Fold semantic boundary
  -> create independent child FAM
  -> assign fam_ref / revision
  -> replace parent ownership with reference boundary
  -> keep compatibility projection
  -> Human Test
```

既存node / edge / unknown fieldを即削除しない。migration receiptを残す。

## 自動検証とHuman Test

自動testでは少なくとも次を分ける。

```text
base FAM read/write
reference profile conformance
FAM extraction losslessness
reference resolver
Runner atomic dispatch
GUI composed projection
```

Human Testは[`../testing/fam-reference-boundary-human-acceptance.ja.md`](../testing/fam-reference-boundary-human-acceptance.ja.md)を正本とする。

`AUTOMATED-REFERENCE-CONTRACT-PASS`を`HUMAN-REFERENCE-BOUNDARY-PASS`へ自動昇格しない。

## IBD境界

IBDでのvector graph DB / RDB永続化、索引、cross-session resolve、revision lineage persistenceは本仕様の実装済み範囲に含めない。

Browser / in-memory registryでreference contractを検証できるが、永続参照が無い状態をpersistent OAE / FAM management systemと呼ばない。
