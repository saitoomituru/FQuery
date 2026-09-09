# @fquery/fam-edit

canonical FAMの編集を、GUI向けdraft操作とCoreのrevision確定へ分離して提供します。

## Draft / presentation helper

- malformed textを`unparsed`のまま保持し、silent dropしない
- diff preview、JSON Pointer navigation、Unsupported Data分類を提供する
- GUIは`FamDraftPatch`をrequestとして発行し、canonical FAMを直接更新しない
- draft validator結果は表示用であり、Coreの採否を代行しない

## Core edit engine

- `set`、`remove`、`insert`をJSON Pointerで指定する
- `fam_id`、`schema_version`、`revision_id`はpatchで変更しない
- base revisionの一致を検査し、新revision候補を生成する
- 元documentと未知fieldを保持する
- base validatorがrejectした候補をcanonical FAMへ昇格しない。raw draftとreject receiptは保持する
- 拡張profile不適合はbase不正と分け、未知fieldを理由にreject・削除しない
- before/after hash、validation issue、loss、source非変更をreceiptへ残す
- parent patchはreview後だけ適用し、影響childを再検証対象へ返す

GUI component、editor widget、保存先、Human Testはこのpackageの責務ではありません。

Authority: FQuery Issue #22, #27, #28。
