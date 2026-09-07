# @fquery/fam-edit

FAM JSONを直接上書きせず、patchから新revision候補と検証receiptを生成するCore engineです。

- `set`、`remove`、`insert`をJSON Pointerで指定する
- `fam_id`、`schema_version`、`revision_id`はpatchで変更しない
- 元documentと未知fieldを保持する
- validatorがrejectした候補をacceptedへ昇格しない
- GUI component、editor widget、保存先、Human Testは所有しない

```ts
const decision = applyFamPatch(document, {
  operationId: "edit://session/1",
  baseRevisionId: document.value.revision_id,
  resultRevisionId: "rev://example/2",
  patches: [{ op: "set", path: "/Q/review_status", value: "draft" }],
});
```
