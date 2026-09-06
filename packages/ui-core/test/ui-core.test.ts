import { describe, expect, it } from "vitest";
import type { QueryResult } from "@fquery/core";
import {
  PluginPresentationRegistry,
  applyEnginePresentationEvent,
  createNodeViewModel,
  statusTone,
  type PresentationFam,
  type PresentationProjectionState,
} from "../src/index.js";

const unconnected: QueryResult = {
  queryRef: "q://test/ui",
  resolutionStatus: "resolved",
  connectionStatus: "unconnected",
  transportStatus: "not-started",
  pluginStatus: "not-requested",
  semanticStatus: "unknown",
  lambdaStatus: "unknown",
  controlStatus: "result",
  evidenceRefs: [],
};

describe("UI Core", () => {
  it("unconnectedをdangerへ変換しない", () => {
    expect(statusTone("unconnected")).toBe("notice");
    expect(createNodeViewModel(unconnected).ports[1]?.connectionStatus).toBe("unconnected");
  });

  it("unknownとbottomを別toneへ写像する", () => {
    expect(statusTone("unknown")).toBe("unknown");
    expect(statusTone("bottom")).toBe("danger");
  });

  it("Last Orderを操作可能なViewModelとして保持する", () => {
    const viewModel = createNodeViewModel({
      ...unconnected,
      controlStatus: "last-order",
      lastOrder: { code: "WAIT", reason: "resource", requestedNext: "supply", resumeWhen: "available" },
    });
    expect(viewModel.lastOrder?.requestedNext).toBe("supply");
    expect(viewModel.canExecute).toBe(true);
  });
});

const presentation: PresentationFam = {
  schemaVersion: "fquery.presentation-fam/0.1.0-draft",
  presentationId: "presentation://sensor/default",
  targetRef: "capability://sensor.force-torque",
  surfaces: ["node-editor", "node-palette", "inspector"],
  visualRole: "sensor",
  interfaceRoles: ["source"],
  visibility: "visible",
  rendererHint: "sensor-gauge",
  category: "Sensor",
  aliases: ["force", "torque"],
  layoutSlotRef: "ibd://layout/session-1/sensor",
};

describe("Presentation FAM Controller", () => {
  it("plugin capabilityをnative rendererへ投影する", () => {
    const registry = new PluginPresentationRegistry();
    registry.register({ pluginId: "sensor", pluginVersion: "1.0.0", capability: "sensor.force-torque", presentation });

    expect(registry.project({
      targetRef: "fam://node/sensor",
      capability: "sensor.force-torque",
      renderer: { rendererId: "vue", supportedHints: ["sensor-gauge"] },
    })).toMatchObject({ mode: "native", rendererId: "vue", presentation });
  });

  it("renderer非互換時も意味参照をgeneric表示へ保持する", () => {
    const registry = new PluginPresentationRegistry();
    registry.register({ pluginId: "sensor", pluginVersion: "1.0.0", capability: "sensor.force-torque", presentation });

    expect(registry.project({
      targetRef: "fam://node/sensor",
      capability: "sensor.force-torque",
      renderer: { rendererId: "plain", supportedHints: [] },
    })).toMatchObject({ mode: "generic", reason: "renderer-unsupported", presentation });
  });

  it("plugin未ロード時にsemantic nodeをghost projectionとして残す", () => {
    const registry = new PluginPresentationRegistry();
    expect(registry.project({
      targetRef: "fam://node/missing",
      capability: "missing.capability",
      renderer: { rendererId: "vue", supportedHints: [] },
    })).toEqual({
      targetRef: "fam://node/missing",
      mode: "ghost",
      rendererId: "vue",
      reason: "plugin-unavailable",
    });
  });

  it("同一capabilityの複数pluginを保持し未選択をghostへ残す", () => {
    const registry = new PluginPresentationRegistry();
    registry.register({ pluginId: "gemini", pluginVersion: "1.0.0", capability: "fam.decompose", presentation });
    registry.register({ pluginId: "ollama", pluginVersion: "1.0.0", capability: "fam.decompose", presentation: { ...presentation, presentationId: "presentation://ollama" } });

    expect(registry.registrations()).toHaveLength(2);
    expect(registry.project({
      targetRef: "fam://node/decompose",
      capability: "fam.decompose",
      renderer: { rendererId: "vue", supportedHints: ["sensor-gauge"] },
    })).toMatchObject({ mode: "ghost", reason: "plugin-selection-unresolved" });
    expect(registry.project({
      targetRef: "fam://node/decompose",
      capability: "fam.decompose",
      pluginId: "ollama",
      renderer: { rendererId: "vue", supportedHints: ["sensor-gauge"] },
    })).toMatchObject({ mode: "native", presentation: { presentationId: "presentation://ollama" } });
  });

  it("pixel layout実値をPresentation FAMへ混入させない", () => {
    const registry = new PluginPresentationRegistry();
    expect(() => registry.register({
      pluginId: "bad",
      pluginVersion: "1.0.0",
      capability: "bad.layout",
      presentation: { ...presentation, presentationId: "presentation://bad", x: 20 } as PresentationFam,
    })).toThrow("layout実値はPresentation FAMへ保存できません");
  });

  it("engine eventで対象nodeだけを局所更新する", () => {
    const first = createNodeViewModel(unconnected, "first");
    const second = createNodeViewModel({ ...unconnected, queryRef: "q://test/second" }, "second");
    const state: PresentationProjectionState = { nodes: [first, second], presentations: {}, engineStates: {} };
    const updatedFirst = { ...first, label: "updated" };
    const next = applyEnginePresentationEvent(state, { type: "fam.node.changed", node: updatedFirst });

    expect(next.nodes[0]).toBe(updatedFirst);
    expect(next.nodes[1]).toBe(second);
    expect(next.presentations).toBe(state.presentations);
  });

  it("plugin消失eventをghostへ写像し既存Presentation FAMを失わない", () => {
    const state: PresentationProjectionState = {
      nodes: [],
      presentations: {
        "fam://node/sensor": { targetRef: "fam://node/sensor", mode: "native", rendererId: "vue", presentation },
      },
      engineStates: {},
    };
    const next = applyEnginePresentationEvent(state, { type: "plugin.removed", targetRef: "fam://node/sensor" });
    expect(next.presentations["fam://node/sensor"]).toMatchObject({ mode: "ghost", presentation });
  });
});
