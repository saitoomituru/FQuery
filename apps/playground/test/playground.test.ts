import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import App from "../src/App.vue";

describe("FQuery Playground", () => {
  it("APIキーなしのfixture modeでrouteとQ nodeを表示する", () => {
    const wrapper = mount(App);
    expect(wrapper.text()).toContain("LOCALHOST / FIXTURE MODE");
    expect(wrapper.text()).toContain("fam.decompose");
    expect(wrapper.get("select").element.value).toBe("fixture");
  });
});
