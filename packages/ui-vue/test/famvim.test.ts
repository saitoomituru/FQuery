import { mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateFamJson } from "@fquery/fam-core";
import { previewFamDraftPatch, openFamText, type FamDraftPatch } from "@fquery/fam-edit";
import FQueryFamvim from "../src/FQueryFamvim.vue";

const fixtureText = readFileSync(join(process.cwd(), "../../fixtures/valid/fam-decomposition.json"), "utf8");
const withUnknown = { ...(JSON.parse(fixtureText) as Record<string, unknown>), "x-plugin-extension": { retained: true } };

describe("FQueryFamvim", () => {
  it("canonical FAMをpath navigationとRAW textで表示しunknown fieldも列挙する", () => {
    const wrapper = mount(FQueryFamvim, { props: { targetRef: "q://test/famvim", value: withUnknown, validate: validateFamJson, knownPointers: ["/ψ", "/λ", "/Q", "/∇φ"] } });
    expect(wrapper.get("textarea").element.value).toContain("\"x-plugin-extension\"");
    expect(wrapper.get('[data-pointer="/x-plugin-extension/retained"]').attributes("data-unsupported")).toBe("true");
    expect(wrapper.get('[data-pointer="/ψ/source_text"]').attributes("data-unsupported")).toBeUndefined();
    expect(wrapper.get('[aria-label="canonical authority"]').text()).toContain("fam://fixture/rain-umbrella");
    expect(wrapper.get('[aria-label="validator result"]').text()).toContain("valid");
    expect(wrapper.get('[aria-label="diff preview"]').text()).toContain("なし");
  });

  it("編集をdiff previewへ出し、適用でfam.patch requestだけをemitしModelを書かない", async () => {
    const wrapper = mount(FQueryFamvim, { props: { targetRef: "q://test/famvim", value: withUnknown, validate: validateFamJson } });
    const edited = wrapper.get("textarea").element.value.replace("\"原文を意味単位へ分解する\"", "\"編集後\"");
    await wrapper.get("textarea").setValue(edited);
    expect(wrapper.get('[aria-label="diff preview"]').text()).toContain("/λ/purpose");
    await wrapper.get('[aria-label="FAMVIM RAW FAM editor"] footer button').trigger("click");
    const events = wrapper.emitted("event");
    expect(events).toHaveLength(1);
    const event = events![0]![0] as { type: string; property: string; value: FamDraftPatch; targetRef: string };
    expect(event).toMatchObject({ type: "property.change.requested", property: "fam.patch", targetRef: "q://test/famvim" });
    expect(event.value.operations).toEqual([{ op: "set", path: "/λ/purpose", value: "編集後" }]);
    const applied = previewFamDraftPatch(openFamText(JSON.stringify(withUnknown)), event.value, { validate: validateFamJson });
    expect(applied.validation?.valid).toBe(true);
    expect(applied.document.parse === "parsed" && (applied.document.value as Record<string, unknown>)["x-plugin-extension"]).toEqual({ retained: true });
    expect((withUnknown as { λ: { purpose: string } }).λ.purpose).toBe("原文を意味単位へ分解する");
  });

  it("malformed draftを保持しparse errorを表示し、validator結果と分離する", async () => {
    const wrapper = mount(FQueryFamvim, { props: { targetRef: "q://test/famvim", value: withUnknown, validate: validateFamJson } });
    await wrapper.get("textarea").setValue("{ broken");
    expect(wrapper.get("textarea").element.value).toBe("{ broken");
    expect(wrapper.get('[role="alert"]').text()).toContain("draft unparsed");
    await wrapper.get('[aria-label="FAMVIM RAW FAM editor"] footer button').trigger("click");
    const event = wrapper.emitted("event")![0]![0] as { property: string; value: string };
    expect(event).toMatchObject({ property: "fam.text", value: "{ broken" });
  });

  it("validator違反でも編集requestは可能で、violationを別軸で表示する", async () => {
    const wrapper = mount(FQueryFamvim, { props: { targetRef: "q://test/famvim", value: withUnknown, validate: validateFamJson } });
    const value = { ...withUnknown } as Record<string, unknown>;
    delete value.ψ;
    await wrapper.get("textarea").setValue(JSON.stringify(value, null, 2));
    expect(wrapper.get('[aria-label="validator result"] p').attributes("data-valid")).toBe("false");
    expect(wrapper.get('[aria-label="validator result"]').text()).toContain("axis-required");
    expect(wrapper.get('[aria-label="FAMVIM RAW FAM editor"] footer button').attributes("disabled")).toBeUndefined();
  });

  it("jumpToでpathを選択しtextareaの該当行を選択する", async () => {
    const wrapper = mount(FQueryFamvim, { attachTo: document.body, props: { targetRef: "q://test/famvim", value: withUnknown, jumpTo: null } });
    await wrapper.setProps({ jumpTo: "/x-plugin-extension/retained" });
    expect(wrapper.get('[data-pointer="/x-plugin-extension/retained"]').attributes("aria-current")).toBe("true");
    const textarea = wrapper.get("textarea").element;
    expect(textarea.value.slice(textarea.selectionStart, textarea.selectionEnd)).toContain("\"retained\": true");
    wrapper.unmount();
  });

  it("canonical未生成ではNOT PROVIDEDを表示し編集を無効化する", () => {
    const wrapper = mount(FQueryFamvim, { props: { targetRef: "q://test/famvim" } });
    expect(wrapper.text()).toContain("NOT PROVIDED");
    expect(wrapper.get("textarea").attributes("disabled")).toBeDefined();
  });
});
