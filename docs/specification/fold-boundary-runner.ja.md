# atomic Fold boundary RunnerとG/D/L/mL/S構造座標

状態: `DRAFT-IMPLEMENTED-PROFILE / HUMAN-RETEST-PENDING`

## 目的

分解した子node群を互いに無関係なGUI部品として放出せず、意味を保ったまま一括解決し、一つの処理単位として出口へ渡す。Fold boundaryは装飾的なgroupではなく、次の実行契約を持つ。

```text
resolution_mode = atomic-resolution
dispatch_mode   = single-processing-unit
```

同じ親Foldの実行中は次の再帰分解要求を受理しない。親revision、入力、providerまたはmodelが変わった再実行ではgenerationを進め、旧boundaryとその子を一括交換する。中止済み旧generationの遅延応答はgraphへ接続しない。

## `fold_boundary.boundary_metrics` namespace

短縮表示はG/D/L/mL/Sを使うが、機械契約では必ずFold boundaryの`boundary_metrics`配下へ閉じる。完全pathは`fold_boundary.boundary_metrics`である。Dは`context_dimension_count`、Lは`technical_layer_ref`／tool chainの系譜を維持し、判断を含むcontext chainだけをmLへ分離する。

| 軸 | 名称 | coreが返す値 |
|---|---|---|
| G | Gravity | boundaryを跨いだFold-on-Fold path深度の`max/median/min` |
| D | Dimension | Fold内で明示された一意なcontext dimension数 |
| L | Layer | API、adapter、tool等のtechnology/tool chain長と接続状態 |
| mL | meta Layer | 判断・解釈を含むcontext/meta chain長。Machine Learningの`ML`と区別するため小文字`m`を保持 |
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

`max`と`min`は整数である。要素数が偶数の`median`は中間2値の平均であり、小数を取り得る。平均、分散、percentile等はcoreへ追加しない。pluginが必要とする場合は、生のnest path深度またはchain長を入力として受けて算出する。直下node数はDへ混ぜず`direct_child_count`として分離する。

## 境界判定

1. Fold boundaryを一つ跨ぐたび、そのpathのGを`+1`する。
2. DはFold内の一意な`context_dimension_ref`数とする。同じdimensionを複数nodeが共有しても一度だけ数える。
3. Lは宣言済みのtechnology/tool edgeだけからroot-to-leaf pathごとのnode数を測る。必須entry→exit routeが切れていれば`continuity=disconnected`とする。
4. mLは判断・解釈を含むcontext/meta edgeだけから測る。mLの連続を、切れたLの実行成功へ流用しない。
5. 欠落nodeを参照するedge、重複edge、cycleは閉じたchainとして成功扱いしない。
6. Sは専用node pluginと出口adapterの両方が揃った場合だけ`socket_present=true`とする。

Sが不成立なら`FOLD-SOCKET-MISSING`、必須L routeが切れた場合は`FOLD-TOOL-CHAIN-DISCONNECTED`のLast Orderを元経路へ返す。これは想像や信頼による続行そのものを否定しない。明示的に別branchへ分け、`domain_ref`、`claimant_ref`、`spiritual-trust`または`imaginative-hypothesis`、`not-verified`／`verification-not-applicable`／`verification-prohibited`を保持すれば続行できる。ただし元のLは`disconnected`のままとし、別domainの信頼を検証成功receiptへ変換しない。

完全検証が無意味、射程外、またはRed Hat化を招くため実行してはならない場合、`verification-prohibited`は正規の停止境界である。「検証できないので霊的に信用して進める」は、明示されたspiritual domainの`declared-belief`として有効であり、World-global factやtool verification passではない。

## #35での実装境界

#35ではrecursive Whyの子graphをboundaryへネストし、busy状態、chattering防止、generation直列化、旧応答遮断、FoldLog alphaへの`boundary_metrics`記録までを扱う。Playground上の境界表示はHuman Testに必要な最小debug表示であり、Gの視覚的な深度表現やD/L/mLの本表示設計は後続Issueとする。

IBDでの永続化、索引、revision管理は本仕様の実装済み範囲に含めない。BrowserのFoldLog alphaはOAE recordを生成できるが、永続OAE管理システムではない。
