# FAM非破壊編集Engine 0.1.0-draft

## 責務

`@fquery/fam-edit`はFAM JSONの編集要求を検証し、元revisionを変更せずに新revision候補とreceiptを返すCore機能である。GUI editor、表示、操作event、保存backendは所有しない。

```text
Editor GUI
  -> FamDraftPatch / fam.text（requestのみ）
  -> Host adapter
  -> FamPatchRequest（operation / base / result revision）
  -> FAM edit engine
  -> accepted(new revision + receipt)
     | rejected(original revision + receipt)
  -> Editor GUI presentation
```

Fold参照境界のcorrectiveでは、通常patchに加えて**subtreeを独立FAMへ抽出し、parentをreference boundaryへ置換するprimitive**を追加候補とする。具体型名は実装時に既存APIへ合わせる。

## 不変条件

- `fam_id`、`schema_version`、`revision_id`をpatchで直接変更しない
- `baseRevisionId`が現在値と異なる要求を適用しない
- 新revision IDは呼出側が明示する
- 元documentを変更しない
- 未知fieldを既知Schema外という理由で削除しない
- base構造に適合しない候補をcanonical FAM revisionへ無言で昇格しない。ただしraw draftとreject receiptは保持する
- 拡張profileの不適合だけを理由に、base構造が有効な候補や未知fieldを破棄しない。`profile_conformance`として別記録する
- profile固有制約はvalidator注入で追加し、FAM Core既定値へ暗黙統合しない
- receiptをFAM本文へ混入させない
- 同一FAM内のshared nodeを作るためにidentity fieldを複製しない
- Fold extractionでchild内容をsummaryだけへ縮約しない

## GUI draftとの境界

`draft.ts`の`openFamText`、`diffJson`、`partitionPointers`、
`renderPointerLines`、`FamDraftPatch`は、RAW editorとNode Panelが
canonical候補を観察してrequestを組み立てるためのpresentation helperである。

- draft previewの`applied`はCoreの`accepted`ではない
- validator違反やmalformed draftでもGUIはrequest可能性を保持できる
- Host adapterがdraft operationを`FamPatchRequest`へ写像する
- canonical更新、revision生成、protected field、validation採否はCore engineだけが行う
- Playgroundのadapterはfixture保存ではなく、このCore engineを通す

## Patch

pathはRFC 6901形式のJSON Pointerを使用する。

- `set`: object propertyまたは既存array elementを設定する
- `remove`: propertyまたはarray elementを削除する
- `insert`: pathが示すarrayへ指定indexで挿入する

root全体の置換とidentity fieldの直接変更は禁止する。最小4軸keyの削除等はbase validatorがcanonical採用をrejectし、検出したfield単位のissueをreceiptへ残す。追加profile fieldの欠落・規定外fieldの存在はbase rejectへ短絡させない。

## Independent FAM extraction

### 目的

次のようなsubtree / Fold boundaryを、parent FAM内のhidden child/shared nodeとして保持せず、独立FAMへ切り出す。

- atomic processing boundaryとして扱う
- 複数semantic consumerから参照する
- 独立revision / Q / provenance / OAEが必要
- parentとは別Runner / model / toolへdispatchする

### 概念request

```text
sourceFamRef
baseRevisionRef
selection:
  boundaryPointer | nodeRefs[]
childFamRef
childRevisionRef
parentResultRevisionRef
referenceProfileRef
```

### 処理

```text
resolve selection
  -> closed boundaryを検査
  -> selected subtreeをlossless copy
  -> child FAM identity / revisionを付与
  -> parent subtreeをreference boundaryへ置換
  -> parent/child base structureを検査
  -> profile conformanceを別評価
  -> receipt生成
```

### 出力

```text
accepted:
  parentFam@newRevision
  childFam@revision
  referenceBinding
  extractionReceipt

rejected:
  original parent revision
  child candidate（生成済みなら破棄せずrawで保持可能）
  rejectionReceipt
```

### shared reference

同一child FAMを複数parent / Foldから参照する場合、childを複製patchしない。

```text
FAM-A -> ref -> FAM-X
FAM-B -> ref -> FAM-X
```

参照側ごとの解釈差はrelation profile / Access Mapper / Observer OAE等へ置く。

### migration receipt

最低限:

- operation ID
- source parent FAM / revision
- selected node / pointer refs
- created child FAM / revision
- parent before / after SHA-256
- child digest
- moved / preserved refs
- unknown field retention
- loss status
- observer / actor / rule / profile refs
- observed_at

を保持する。

このreceiptは「childが叡智である」「factとして正しい」を意味しない。独立identityへ抽出した操作を証明するだけである。

## Receipt

accepted／rejectedの双方が、operation ID、base／result revision、patch、before／after SHA-256、validation issue、loss、観測時刻を持つ。reject時の`afterSha256`は`null`であり、元documentを返す。

`sourceMutation: false`は過去revisionを上書きしないことを表す。編集結果が意味的に正しい、Human review済み、永続化済み、公開済みであることは意味しない。

編集receiptは、誰または何が修正を要求したかを`observer_ref`／`actor_ref`、どの定規で採用したかを`rule_ref`／`profile_ref`、どのscopeで採用したかを`adoption_scope_ref`として外部参照可能にする。これらの未接続は修正履歴を削除する理由ではなく、`unknown`または`not-evaluable`として残す。

編集可能性は失敗の隠蔽ではない。初回候補が不完全でも、局所修正、branch、revision、差分、receiptから回復できることをCoreのresilience要件とする。修正不能な完全回答を一回で生成することを成功条件にしない。

## Parent patchとchild再検証

child resultからparent FAMを直接変更しない。`FamParentPatchProposal`としてpatch、元parent revision、child result参照、child依存pathを提示し、`FamParentPatchReview`で次の処置を明示する。

- `accept-patch`
- `reject-patch`
- `fork-parent`
- `mark-exception`
- `escalate-to-grandparent`
- `requires-external-test`

`accept-patch`だけが新revision生成へ進む。他の処置は元parentを返し、未適用状態を保持する。patch pathとchildの観測pathが祖先・子孫関係にある場合、そのchildを`revalidateChildRefs`へ返す。再検証対象の算出は再検証成功を意味しない。

独立child FAMへ抽出済みの場合、parent patchはchild本文を再inlineせず、reference binding / relation / projectionだけを更新する。

## 関連

- [`fam-reference-boundary.ja.md`](fam-reference-boundary.ja.md)
- [`../architecture/fam-reference-extraction.ja.md`](../architecture/fam-reference-extraction.ja.md)
- [`fold-boundary-runner.ja.md`](fold-boundary-runner.ja.md)
