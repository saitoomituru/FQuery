# @fquery/fam-edit

canonical FAMをlosslessに部分編集するためのprimitive。

- FAM Coreのschema／validatorを所有しない。validatorは呼び出し側が注入する
- 未知field／subtreeを削除せず保持する。編集対象pathだけを変更する
- malformed textは`unparsed`として保持し、silent dropしない
- 全編集はdiffとreceiptを伴う。`applied != valid`であり、strict validation結果と編集可能性は別軸

Authority: FQuery Issue #27, #28。FAM Coreの意味正本はIssue #22。
