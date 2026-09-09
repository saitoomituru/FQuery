# Fold subtreeから独立FAMへ抽出するarchitecture

状態: `DESIGN-CORRECTIVE / IMPLEMENTATION-PENDING`

関連仕様: [`../specification/fam-reference-boundary.ja.md`](../specification/fam-reference-boundary.ja.md)

## 背景

現行Playgroundは、Fold boundary配下のchild node群を一枚のsession / React Flow graphへ保持する実装を含む。この構造はpresentationとしては動作し得るが、canonical semantic ownershipまで同一graphへ寄せると次の事故が起きる。

- recursive DeFold時にparent/child identityが混線する
- 同じ意味単位を複数Foldから使うとshared node DAGが必要になる
- Fold close/openでhidden child stateとcanonical stateを取り違える
- rendererのparentageがsemantic parentageへ逆流する
- child revisionとparent revisionの責務が混ざる
- 一枚JSONを平滑化しようとするprovider/validator biasを強化する

このため、Fold抽出をsemantic normalization operationとして導入する。

## 1. Canonical objects

```text
FamDocument
  famRef
  revisionRef
  payload: ψ / ∇φ / λ / Q + extensions

FamReference
  sourceFamRef
  sourceRevisionRef
  sourcePointer / foldRef
  targetFamRef
  targetRevisionPolicy
  relationProfileRef

FoldProjection
  foldRef
  famRef
  revisionRef
  presentationState
  projectionStatus
```

具体TypeScript名は実装時に既存package責務へ合わせる。上記名称をそのままCore classへ固定する必要はない。

## 2. Extraction trigger

次のいずれかを観測したら`extraction candidate`を作る。

1. semantic subtreeがFold boundaryとしてatomic処理を要求する
2. subtreeを複数semantic consumerが参照する
3. subtreeへ独立revision / Q / provenance / OAEが必要
4. subtreeをparentとは別のRunner / model / human / toolへdispatchしたい
5. Humanが明示的に「独立FAMへ切り出す」を要求する

自動抽出は意味の真偽判定ではない。候補を生成し、active profile / authority / Human gateで採否できるようにする。

## 3. Extraction operation

```text
input:
  parentFam@revision
  boundaryPointer / selectedNodeRefs
  extractionProfileRef

resolve selection
  -> verify closed semantic boundary
  -> copy selected canonical subtree losslessly
  -> assign child famRef
  -> assign child revisionRef
  -> replace parent subtree with reference boundary
  -> validate parent base structure
  -> validate child base structure
  -> create migration receipt

output:
  parentFam@newRevision
  childFam@revision1
  reference binding
  receipt
```

### lossless要件

- unknown fieldを保持
- source language / mixed codeを保持
- provenanceを保持
- stable node refsを可能な範囲で保持し、跨FAM時にcollisionする場合はmapping receiptを残す
- Qを勝手に再解釈しない
- child内容をsummaryだけへ縮約しない

## 4. Reference revision policy

parentがchildのどのrevisionを見るかは一値に固定しない。

候補:

```text
pinned
  targetRevisionRefを固定

follow-latest-compatible
  profile compatibilityを満たす最新revision

authority-selected
  上位Systemがrevisionを注入

unresolved
  targetは存在するがrevision採用が未確定
```

Coreは「最新が正しい」と決めない。

## 5. Runtime resolve

```text
run(parent)
  -> reference boundary
  -> resolver.resolve(famRef, revisionPolicy)
  -> unavailable?
       -> Last Order / unresolved
  -> run(child as atomic unit)
  -> child result + receipt
  -> return through declared gate
```

同じchildを複数箇所から呼ぶ場合、cache / memoization / parallel executionはexecution policyでありsemantic identityではない。

## 6. GUI compose

GUIは一枚graphへflattenせず、複数document projectionを一つのcanvasへ合成する。

各rendered nodeに最低限、どのFAM projection由来かを追跡できるopaque refを持たせる。

```text
render node identity
  view-local id
  semantic node ref
  owning fam ref
  owning fam revision
```

React Flow idをsemantic identityへ昇格しない。

### Fold close

```text
projection(FAM-X) visible
  -> close
  -> internal projection hidden
  -> boundary remains
  -> FAM-X unchanged
```

### DeFold

```text
boundary
  -> resolve FAM-X
  -> create child projection
  -> compose into viewport
```

親documentへchild JSONをmergeしない。

## 7. Shared reference

同一`FAM-X`をA/Bが参照する場合:

```text
FAM-A -> FAM-X
FAM-B -> FAM-X
```

A用の解釈とB用の解釈が異なる場合、FAM-X自身を複製改変せず、relation / Access Mapper / refFAM / Observer OAEを参照側に置ける。

必要ならFAM-Xをforkして別identityとする。forkとaliasを混同しない。

## 8. FAMLog / OAE

抽出は必ず観測可能にする。

候補operation:

```text
fold-extraction-requested
fold-extraction-candidate
fam-created
parent-reference-replaced
fold-extraction-accepted
fold-extraction-rejected
reference-resolved
reference-resolution-failed
```

recordには最低限:

- trace/event/parent event
- observer / initiator / executor
- source parent FAM + revision
- target child FAM + revision
- selected node/pointer refs
- before/after digest
- loss status
- active profile / authority ref
- observed_at

を保持する。

## 9. package responsibility候補

```text
@fquery/fam-core
  base read/write + reference shape/profile seam

@fquery/fam-edit
  extraction patch / parent replacement / receipt primitive

@fquery/core
  resolver port / Runner orchestration

@fquery/famlog
  extraction/reference event profile

@fquery/ui-core
  cross-FAM projection ViewModel

@fquery/ui-react
  composed graph rendering only

Host / IBD adapter
  actual persistence / ref resolution
```

IBD永続化が無くてもin-memory registryでcontract testできる。

## 10. migration phases

### Phase A: contract only

- reference profile
- extraction receipt shape
- no GUI behavior change

### Phase B: in-memory child FAM registry

- nested DeFold resultを独立FAMとして登録
- parentはreference boundaryを持つ
- legacy presentation adapterで現行UIを維持

### Phase C: composed GUI projection

- child documentを別projectionとして描画
- close/openでidentity保持
- shared ref display

### Phase D: persistence adapter

- IBD contractへput/get/resolve
- revision policy
- restart後recovery

### Phase E: legacy nested ownership removal

- canonical hidden-child pathを削除
- compatibility readerのみ残す

各Phaseのautomated passを次PhaseのHuman passへ無断昇格しない。

## 11. implementation gates

- base open-world validator修正（#22）より先にclosed schemaを追加しない
- #41 provider topologyを一発完全JSONへ強制しない
- #35 GUIを見た目だけnestedにしてcontract完了としない
- #37 G/D/L/mL/Sをrenderer objectから算出しない
- unknown / unsupported artifactをmigration時に削除しない

## 12. 完了条件

実装完了は、少なくとも次を満たした時点。

- parent/childが独立FamDocumentとして存在
- parentはrefでchildを呼ぶ
- close/openでchild revision不変
- shared refがcopyなしで成立
- restart / rehydrate後もref解決可能（persistence phaseまで行う場合）
- HumanがRAW FAMでparentとchildを別documentとして確認できる
- OAE/FAMLogから抽出経路を再構成できる
