# FAM非破壊編集Engine 0.1.0-draft

## 責務

`@fquery/fam-edit`はFAM JSONの編集要求を検証し、元revisionを変更せずに新revision候補とreceiptを返すCore機能である。GUI editor、表示、操作event、保存backendは所有しない。

```text
Editor GUI
  -> FamPatchRequest
  -> FAM edit engine
  -> accepted(new revision + receipt)
     | rejected(original revision + receipt)
  -> Editor GUI presentation
```

## 不変条件

- `fam_id`、`schema_version`、`revision_id`をpatchで直接変更しない
- `baseRevisionId`が現在値と異なる要求を適用しない
- 新revision IDは呼出側が明示する
- 元documentを変更しない
- 未知fieldを既知Schema外という理由で削除しない
- validatorに適合しない候補を保存成功へ昇格しない
- profile固有制約はvalidator注入で追加し、FAM Core既定値へ暗黙統合しない
- receiptをFAM本文へ混入させない

## Patch

pathはRFC 6901形式のJSON Pointerを使用する。

- `set`: object propertyまたは既存array elementを設定する
- `remove`: propertyまたはarray elementを削除する
- `insert`: pathが示すarrayへ指定indexで挿入する

root全体の置換とidentity fieldの直接変更は禁止する。必須4軸の削除等は最終validatorがrejectし、検出したfield単位のissueをreceiptへ残す。

## Receipt

accepted／rejectedの双方が、operation ID、base／result revision、patch、before／after SHA-256、validation issue、loss、観測時刻を持つ。reject時の`afterSha256`は`null`であり、元documentを返す。

`sourceMutation: false`は過去revisionを上書きしないことを表す。編集結果が意味的に正しい、Human review済み、永続化済み、公開済みであることは意味しない。

## Parent patchとchild再検証

child resultからparent FAMを直接変更しない。`FamParentPatchProposal`としてpatch、元parent revision、child result参照、child依存pathを提示し、`FamParentPatchReview`で次の処置を明示する。

- `accept-patch`
- `reject-patch`
- `fork-parent`
- `mark-exception`
- `escalate-to-grandparent`
- `requires-external-test`

`accept-patch`だけが新revision生成へ進む。他の処置は元parentを返し、未適用状態を保持する。patch pathとchildの観測pathが祖先・子孫関係にある場合、そのchildを`revalidateChildRefs`へ返す。再検証対象の算出は再検証成功を意味しない。
