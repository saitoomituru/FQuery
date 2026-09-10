# FAM参照境界 / Fold extraction contract

状態: `DESIGN-CORRECTIVE / IMPLEMENTATION-PENDING`

正本思想: [ZeroRoomLab-manifest `85d1b5d`](https://github.com/saitoomituru/ZeroRoomLab-manifest/blob/85d1b5db8d46f34671d38a451617c08edff41675/docs/theory/fam-infoton-reference-boundary.ja.md)

## 目的

FQueryでFoldを同一FAM JSON内の単なるnested GUI groupとして扱う実装を廃し、**Fold境界を独立FAM identityへの参照境界として扱う**。

FQueryは巨大な一枚graphを正本化しない。複数Foldから同一`∇φ` / Fold subtreeへの共有参照が必要になった時、その単位を独立FAMへ抽出し、親FAMから`fam_ref`で参照する。

```text
非正規形

FAM-A
  Fold-1 ─┐
          ├─ shared node X
  Fold-2 ─┘

正規形

FAM-A
  Fold-1 ─ ref ─┐
                ├─ FAM-X
  Fold-2 ─ ref ─┘
```

JSONの一般能力ではなく、FAMJSONの意味論としてこの正規形を採用する。

## 1. artifact分類

```text
OAE
  = Observerの観測・評価record

FAMLog
  = 時間方向の操作・観測・修正・所感trace

FAMJSON
  = 再参照可能な独立意味identity / Infotonのwire representation

refFAM
  = fact-freeな問い方・見方・分類・方法・成立条件を記述するFAM
```

`.json`拡張子や`ψ / ∇φ / λ / Q`のshapeだけでは、意味論上のFAMJSON昇格を自動判定しない。FAMJSONとして扱うには、Host / Runner / registry等から独立identityとして参照可能であることを要求するprofileを定義できる。

0参照の単発観測を自動的に情報子へ昇格させず、FAMLog / OAE candidateとして保持できる。

## 2. FAM identity抽出条件

次は独立FAM extraction candidateである。

- 同じ`∇φ` / subtree / Foldを2つ以上のsemantic consumerが参照する
- 同じ意味単位を異なるparent Foldから利用する
- 独立revision、Q、provenance、OAE、authority、lifecycleが必要になる
- Foldとしてatomicに処理し、親のrevisionとは別に再実行・再利用したい

複数参照は「純粋な叡智」の証明ではない。まず可搬性を示す。

内容を分類した結果:

```text
fact / 業務 / 合意 / 個別経験を含む
  -> 通常FAM

factを持たず、問い方・方法・定規・形而上学を記述
  -> refFAM
```

Coreはこの意味分類を宇宙的真理として自動裁定しない。active profile / Observer OAEによりclassification candidateを記録し、Human修正可能にする。

## 3. refFAMにfactを正典化しない

refFAMは旧AQC SchemerのFAM統合版であり、正解集ではない。

refFAMが記述する候補:

- 何を存在として扱うか
- 何を同一／別物とみなすか
- どの問いを立てるか
- どの条件を試すか
- 何を観測・証拠とみなすか
- どこでunknown / Last Orderにするか
- どのWorldへどうmappingするか
- どのように追試・改善するか

factを扱う通常FAMでは、必要なprofileが`Q`へ次を要求できる。

```text
evidence_ref
observer_ref
subject_revision_ref
acquisition_method_ref
verifier_ref
hash / digest receipt
observed_at
```

hashは必要な経路だけで外部verifier / IBD / SQL等が評価する。Core既定でbyte一致をfact成立条件にしない。

### りんご / Newton / 科学の境界例

```text
「りんごが落ちた」
  -> 通常FAMの観測fact

「なぜ落ちる？」
  -> 問い

「別の物でも試す？」
「条件を変える？」
「別Observerでも追試する？」
  -> 対象を越えて持ち運べるmethod
  -> refFAM candidate
```

科学的叡智は個別factそのものではなく、問い・観測・比較・追試を別対象へ再利用できる方法として記述できる。

## 4. Fold boundary = FAM reference boundary

Foldを生成した時、その境界配下のcanonical semantic contentは独立FAMとしてidentityを持つ。

親FAMには内部nodeを複製せず、Fold boundary nodeが参照を持つ。

最小参照例:

```json
{
  "fold_ref": "fold://parent/x",
  "fam_ref": "fam://session/fold/x",
  "revision_ref": "rev://session/fold/x/3",
  "projection_status": "available"
}
```

具体field名はprofile revisionで固定する。FAM Core baseの追加必須fieldへ暗黙昇格しない。

## 5. Fold / DeFold / unFold

### `Fold`

`まとめる-Fold-`はpresentation contractionである。

- 子FAMを削除しない
- `fam_ref`を保持する
- child revision、Q、OAE、provenanceを保持する
- canvasから参照先FAMの内部projectionだけを外す

### `DeFold`

`ひらく-DeFold-` / `なんで？-DeFold-`は参照解決 + projection expansionである。

- `fam_ref`をresolveする
- child FAMを親FAM JSONへinline copyしない
- GUIは複数FAM graphを合成表示できる
- child FAMのidentity / revisionを保持する

### `unFold`

独立FAM境界を破壊し、内容を別表現へbake / merge / replaceする可能性がある破壊操作。Fold / DeFoldから暗黙昇格しない。

```text
Fold / DeFold = reversible reference/presentation operation
unFold         = destructive semantic-boundary operation
```

## 6. GUI projection

React Flow canvasの一枚graphをcanonical FAM topologyにしない。

GUIは次の合成viewを描ける。

```text
FAM-A view
  └─ Fold-X ref
       └─ expanded FAM-X view
            └─ Fold-Y ref
                 └─ expanded FAM-Y view
```

Gは単なるDOM nestingではなく、表示中のFAM reference path depthとして測定できる候補になる。

Foldを閉じても参照先FAMは存在し続ける。

## 7. Runner

RunnerはFold boundaryに到達したら、同一document内のhidden child arrayを実行するのではなく、参照先FAMをresolveしてatomic processing unitとして扱う。

```text
run(FAM-A)
  -> Fold-X
  -> resolve(fam_ref = FAM-X)
  -> run(FAM-X)
  -> λ-X / Last Order / candidate result
  -> return to FAM-A
```

Execution topologyはsemantic reference topologyを上書きしない。同じFAM-Xを複数consumerが参照しても、cache、dedupe、parallelism、re-execution policyはRunner / Host / authority profile側で決める。

## 8. migration / backward compatibility

現行#35実装には、nested child nodesを同一graph object内で保持するpresentation / session構造が存在する。

移行時は既存nodeを即削除しない。

```text
legacy nested subtree
  -> detect shared / Fold boundary
  -> extract independent FAM candidate
  -> assign fam_ref + revision
  -> parentをreference boundaryへ置換
  -> receipt
  -> Human Test
```

migration receiptには最低限、source revision、extracted FAM identity、移動したnode refs、保持したunknown fields、before/after hash、loss statusを残す。

## 9. acceptance criteria

- [ ] Fold生成時に独立FAM identityが作られる
- [ ] parent FAMはchild内部nodeをcanonical shared stateとして所有しない
- [ ] Fold close後も`fam_ref`からchild FAMを再取得できる
- [ ] DeFoldでchild FAMをinline copyせずprojectionできる
- [ ] 同一child FAMを複数parent / Foldから参照できる
- [ ] shared internal nodeを検出した場合、独立FAM extraction candidateとして扱える
- [ ] factを含むartifactをrefFAMへ無断正典化しない
- [ ] refFAM / normal FAM / FAMLog / OAEを別statusで表示できる
- [ ] migrationでunknown fields / provenance / revisionを失わない
- [ ] React Flow graph objectがcanonical cross-FAM identityにならない
- [ ] Human TestでFold close/open後のidentity、edge、λ、revisionを確認する

## 10. non-goals

- 複数参照されたものを自動的に「真理」や「叡智」と断定する
- refFAMへ科学fact、法的fact、ゲームstate等を正解表として集積する
- JSONをgeneral-purpose graph DBへ拡張する
- ref countだけで価値やauthorityを決める
- Fold closeでchild FAMを削除する
- DeFoldでchildを親JSONへコピーする

## 関連

- [`fam-json-core.ja.md`](fam-json-core.ja.md)
- [`fold-boundary-runner.ja.md`](fold-boundary-runner.ja.md)
- [`gui-presentation-contract.ja.md`](gui-presentation-contract.ja.md)
- [`famlog-semantic-dump.ja.md`](famlog-semantic-dump.ja.md)
- Issue #22, #35, #37, #41, #42
