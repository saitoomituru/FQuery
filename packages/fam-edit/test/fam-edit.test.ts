import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validateFamJson } from "@fquery/fam-core";
import {
  applyFamPatch,
  createFamPatch,
  diffJson,
  getAtPointer,
  leafPointers,
  listPointers,
  openFamText,
  partitionPointers,
  replaceFamText,
  type JsonObject,
} from "../src/index.js";

const fixtureText = readFileSync(new URL("../../../fixtures/valid/fam-decomposition.json", import.meta.url), "utf8");

/** validatorが知らないunknown fieldを混ぜた原文 */
const withUnknownText = JSON.stringify({
  ...(JSON.parse(fixtureText) as JsonObject),
  "x-plugin-extension": { retained: true, nested: [1, { deep: "yes" }] },
  Q: { ...(JSON.parse(fixtureText) as { Q: JsonObject }).Q, sin_measure_rule: "future-extension" },
}, null, 2);

describe("fam-edit lossless partial editing", () => {
  it("操作が空なら原文byteをそのまま返しunchangedを記録する", () => {
    const document = openFamText(fixtureText);
    const result = applyFamPatch(document, createFamPatch([]), { validate: validateFamJson });
    expect(result.document.text).toBe(fixtureText);
    expect(result.receipt.status).toBe("unchanged");
    expect(result.validation?.valid).toBe(true);
  });

  it("known pathだけを変更しunknown field／subtreeを保持する", () => {
    const document = openFamText(withUnknownText);
    const result = applyFamPatch(document, createFamPatch([{ op: "set", path: "/λ/purpose", value: "編集後のpurpose" }]), { validate: validateFamJson });
    expect(result.receipt.status).toBe("applied");
    expect(result.diff).toEqual([{ path: "/λ/purpose", change: "replaced", before: "原文を意味単位へ分解する", after: "編集後のpurpose" }]);
    expect(result.document.parse).toBe("parsed");
    const value = result.document.parse === "parsed" ? result.document.value : undefined;
    expect(getAtPointer(value!, "/x-plugin-extension/nested/1/deep")).toBe("yes");
    expect(getAtPointer(value!, "/Q/sin_measure_rule")).toBe("future-extension");
    expect(Object.keys(value as JsonObject)).toEqual(Object.keys(JSON.parse(withUnknownText) as JsonObject));
    expect(result.validation?.valid).toBe(true);
    expect(result.receipt.retainedUntouchedPaths).toBe(listPointers(document.parse === "parsed" ? document.value : null).length - 1);
  });

  it("insert / removeがarrayとobjectの両方でkey順を保つ", () => {
    const document = openFamText(withUnknownText);
    const result = applyFamPatch(document, createFamPatch([
      { op: "insert", path: "/index_subjects/-", value: "降水量" },
      { op: "insert", path: "/index_subjects/0", value: "天気" },
      { op: "remove", path: "/x-plugin-extension/nested/0" },
      { op: "insert", path: "/Q/new_key", value: 1 },
    ]));
    const value = result.document.parse === "parsed" ? result.document.value : undefined;
    expect(getAtPointer(value!, "/index_subjects")).toEqual(["天気", "雨", "傘", "降水量"]);
    expect(getAtPointer(value!, "/x-plugin-extension/nested")).toEqual([{ deep: "yes" }]);
    expect(Object.keys(getAtPointer(value!, "/Q") as JsonObject).at(-1)).toBe("new_key");
  });

  it("1操作でも失敗すればpatch全体をrejectedにしdocumentを変えない", () => {
    const document = openFamText(withUnknownText);
    const result = applyFamPatch(document, createFamPatch([
      { op: "set", path: "/title", value: "変更" },
      { op: "set", path: "/does/not/exist", value: 1 },
    ]));
    expect(result.receipt.status).toBe("rejected");
    expect(result.receipt.rejectedOperation).toEqual({ index: 1, reason: "path-not-found:does" });
    expect(result.document).toBe(document);
    expect(result.diff).toHaveLength(0);
  });

  it("validation失敗とapplied成功を別軸で返す", () => {
    const document = openFamText(fixtureText);
    const result = applyFamPatch(document, createFamPatch([{ op: "remove", path: "/ψ" }]), { validate: validateFamJson });
    expect(result.receipt.status).toBe("applied");
    expect(result.validation?.valid).toBe(false);
    expect(result.validation?.issues.some((issue) => issue.code === "axis-required")).toBe(true);
    expect(result.receipt.validation).toEqual({ valid: false, issueCount: result.validation?.issues.length });
  });

  it("malformed textをunparsedとして保持しpatchを拒否する", () => {
    const document = openFamText("{ \"ψ\": ");
    expect(document.parse).toBe("unparsed");
    expect(document.text).toBe("{ \"ψ\": ");
    const result = applyFamPatch(document, createFamPatch([{ op: "set", path: "", value: {} }]));
    expect(result.receipt.status).toBe("rejected");
    expect(result.receipt.rejectedOperation?.reason).toBe("document-unparsed");
  });

  it("RAW置換はloss receiptを伴いunparsedからの復帰も記録する", () => {
    const broken = openFamText("not json");
    const result = replaceFamText(broken, fixtureText, { validate: validateFamJson });
    expect(result.document.parse).toBe("parsed");
    expect(result.receipt.loss.map((entry) => entry.kind)).toEqual(["manual-replacement", "unparsed-source-discarded"]);
    expect(result.validation?.valid).toBe(true);
    const same = replaceFamText(result.document, fixtureText);
    expect(same.receipt.status).toBe("unchanged");
  });

  it("partitionPointersはknown prefix外のleafをunsupportedとして列挙し無効扱いしない", () => {
    const document = openFamText(withUnknownText);
    const value = document.parse === "parsed" ? document.value : null;
    const partition = partitionPointers(value!, ["/ψ", "/λ/purpose", "/Q/observer_ref"]);
    expect(partition.known).toContain("/ψ/source_text");
    expect(partition.known).toContain("/λ/purpose");
    expect(partition.unsupported).toContain("/x-plugin-extension/retained");
    expect(partition.unsupported).toContain("/Q/sin_measure_rule");
    expect(partition.unsupported).toContain("/λ/output_units/0/ψ/source_text");
    expect(leafPointers(value!)).toContain("/pointers");
  });

  it("diffJsonはpath単位でadded / removed / replacedを返す", () => {
    expect(diffJson({ a: 1, b: [1, 2] }, { a: 2, b: [1], c: "x" })).toEqual([
      { path: "/a", change: "replaced", before: 1, after: 2 },
      { path: "/b/1", change: "removed", before: 2 },
      { path: "/c", change: "added", after: "x" },
    ]);
  });

  it("~ と / を含むkeyをJSON Pointerでescapeして扱う", () => {
    const document = openFamText(JSON.stringify({ "a/b": { "c~d": 1 } }));
    const result = applyFamPatch(document, createFamPatch([{ op: "set", path: "/a~1b/c~0d", value: 2 }]));
    expect(getAtPointer(result.document.parse === "parsed" ? result.document.value : null, "/a~1b/c~0d")).toBe(2);
  });
});
