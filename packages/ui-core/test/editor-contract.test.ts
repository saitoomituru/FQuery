import { describe, expect, it } from "vitest";
import {
  PluginPresentationRegistry,
  coreNodeRegistrations,
  deriveKnownPointers,
  findRegistrationByPresentation,
  registerCoreNodes,
  type PluginPresentationRegistration,
} from "../src/index.js";

const ragPlugin: PluginPresentationRegistration = {
  pluginId: "plugin-rag",
  pluginVersion: "0.1.0",
  capability: "gradient.rag",
  presentation: {
    schemaVersion: "fquery.presentation-fam/0.1.0-draft",
    presentationId: "presentation://plugin-rag/default",
    targetRef: "capability://gradient.rag",
    surfaces: ["node-editor", "inspector"],
    visualRole: "retriever",
    interfaceRoles: ["psi", "fam"],
    visibility: "visible",
  },
  editor: {
    famRole: "∇φ",
    qSchema: { schemaVersion: "fquery.q-schema/0.1.0-draft", properties: { store_ref: { type: "string" }, top_k: { type: "number" }, "a/b": { type: "boolean" } } },
    knownPointers: ["/∇φ/0/method"],
  },
};

describe("Plugin editor contract", () => {
  it("qSchema keyを/Q配下のJSON Pointerへ写像しknownPointersと結合する", () => {
    expect(deriveKnownPointers(ragPlugin.editor)).toEqual(["/Q/store_ref", "/Q/top_k", "/Q/a~1b", "/∇φ/0/method"]);
    expect(deriveKnownPointers(undefined)).toEqual([]);
  });

  it("editor未宣言のregistrationも有効でCore nodeはfamRoleだけを宣言する", () => {
    const registry = new PluginPresentationRegistry();
    registerCoreNodes(registry);
    registry.register({ ...ragPlugin, editor: undefined } as PluginPresentationRegistration);
    expect(registry.registrations()).toHaveLength(4);
    expect(coreNodeRegistrations().map((registration) => registration.editor?.famRole)).toEqual(["ψ", "∇φ", "λ"]);
    expect(coreNodeRegistrations().every((registration) => registration.editor?.qSchema === undefined)).toBe(true);
  });

  it("presentationIdからregistrationを逆引きし、未登録ならundefined（ghost）", () => {
    const registry = new PluginPresentationRegistry();
    registry.register(ragPlugin);
    expect(findRegistrationByPresentation(registry, "presentation://plugin-rag/default")?.pluginId).toBe("plugin-rag");
    expect(findRegistrationByPresentation(registry, "presentation://missing")).toBeUndefined();
    expect(findRegistrationByPresentation(registry, undefined)).toBeUndefined();
  });
});
