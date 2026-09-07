import { cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateFamJson } from "@fquery/fam-core";
import { previewFamDraftPatch, openFamText, type FamDraftPatch } from "@fquery/fam-edit";
import { FQueryFamvim } from "../src/FQueryFamvim.js";

const fixtureText = readFileSync(join(process.cwd(), "../../fixtures/valid/fam-decomposition.json"), "utf8");
const withUnknown = { ...(JSON.parse(fixtureText) as Record<string, unknown>), "x-plugin-extension": { retained: true } };

const textarea = (container: HTMLElement) => container.querySelector("textarea") as HTMLTextAreaElement;
const applyButton = (container: HTMLElement) => container.querySelector('[aria-label="FAMVIM RAW FAM editor"] footer button') as HTMLButtonElement;

afterEach(cleanup);

describe("FQueryFamvim", () => {
  it("canonical FAMをpath navigationとRAW textで表示しunknown fieldも列挙する", () => {
    const { container } = render(<FQueryFamvim targetRef="q://test/famvim" value={withUnknown} validate={validateFamJson} knownPointers={["/ψ", "/λ", "/Q", "/∇φ"]} onEvent={() => {}} />);
    expect(textarea(container).value).toContain("\"x-plugin-extension\"");
    expect(container.querySelector('[data-pointer="/x-plugin-extension/retained"]')?.getAttribute("data-unsupported")).toBe("true");
    expect(container.querySelector('[data-pointer="/ψ/source_text"]')?.getAttribute("data-unsupported")).toBeNull();
    expect(container.querySelector('[aria-label="canonical authority"]')?.textContent).toContain("fam://fixture/rain-umbrella");
    expect(container.querySelector('[aria-label="validator result"]')?.textContent).toContain("valid");
    expect(container.querySelector('[aria-label="diff preview"]')?.textContent).toContain("なし");
  });

  it("編集をdiff previewへ出し、適用でfam.patch requestだけをemitしModelを書かない", () => {
    const events: { type: string; property: string; value: FamDraftPatch; targetRef: string }[] = [];
    const { container } = render(<FQueryFamvim targetRef="q://test/famvim" value={withUnknown} validate={validateFamJson} onEvent={(event) => events.push(event as never)} />);
    const edited = textarea(container).value.replace("\"原文を意味単位へ分解する\"", "\"編集後\"");
    fireEvent.change(textarea(container), { target: { value: edited } });
    expect(container.querySelector('[aria-label="diff preview"]')?.textContent).toContain("/λ/purpose");
    fireEvent.click(applyButton(container));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: "property.change.requested", property: "fam.patch", targetRef: "q://test/famvim" });
    expect(events[0]!.value.operations).toEqual([{ op: "set", path: "/λ/purpose", value: "編集後" }]);
    const applied = previewFamDraftPatch(openFamText(JSON.stringify(withUnknown)), events[0]!.value, { validate: validateFamJson });
    expect(applied.validation?.valid).toBe(true);
    expect((withUnknown as { λ: { purpose: string } }).λ.purpose).toBe("原文を意味単位へ分解する");
  });

  it("malformed draftを保持しparse errorを表示し、validator結果と分離する", () => {
    const events: { property: string; value: string }[] = [];
    const { container } = render(<FQueryFamvim targetRef="q://test/famvim" value={withUnknown} validate={validateFamJson} onEvent={(event) => events.push(event as never)} />);
    fireEvent.change(textarea(container), { target: { value: "{ broken" } });
    expect(textarea(container).value).toBe("{ broken");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("draft unparsed");
    fireEvent.click(applyButton(container));
    expect(events[0]).toMatchObject({ property: "fam.text", value: "{ broken" });
  });

  it("validator違反でも編集requestは可能で、violationを別軸で表示する", () => {
    const { container } = render(<FQueryFamvim targetRef="q://test/famvim" value={withUnknown} validate={validateFamJson} onEvent={() => {}} />);
    const value = { ...withUnknown } as Record<string, unknown>;
    delete value.ψ;
    fireEvent.change(textarea(container), { target: { value: JSON.stringify(value, null, 2) } });
    expect(container.querySelector('[aria-label="validator result"] p')?.getAttribute("data-valid")).toBe("false");
    expect(container.querySelector('[aria-label="validator result"]')?.textContent).toContain("axis-required");
    expect(applyButton(container).disabled).toBe(false);
  });

  it("jumpToでpathを選択しtextareaの該当行を選択する", () => {
    const view = render(<FQueryFamvim targetRef="q://test/famvim" value={withUnknown} jumpTo={null} onEvent={() => {}} />);
    view.rerender(<FQueryFamvim targetRef="q://test/famvim" value={withUnknown} jumpTo="/x-plugin-extension/retained" onEvent={() => {}} />);
    expect(view.container.querySelector('[data-pointer="/x-plugin-extension/retained"]')?.getAttribute("aria-current")).toBe("true");
    const element = textarea(view.container);
    expect(element.value.slice(element.selectionStart, element.selectionEnd)).toContain("\"retained\": true");
  });

  it("canonical未生成ではNOT PROVIDEDを表示し編集を無効化する", () => {
    const { container } = render(<FQueryFamvim targetRef="q://test/famvim" onEvent={() => {}} />);
    expect(container.textContent).toContain("NOT PROVIDED");
    expect(textarea(container).disabled).toBe(true);
  });
});
