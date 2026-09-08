import { describe, expect, it } from "vitest";
import { RecursiveFoldController, recursiveFoldFingerprint } from "../src/host/recursive-fold-controller.js";

describe("RecursiveFoldController", () => {
  it("同一boundaryの連打を一つのprocessing unitへ直列化する", () => {
    const controller = new RecursiveFoldController();
    const first = controller.start("fold://parent", "same");
    const chatter = controller.start("fold://parent", "same");
    expect(first.accepted).toBe(true);
    expect(chatter).toMatchObject({ accepted: false, reason: "already-running", run: { generation: 1 } });
  });
  it("完了済み同一fingerprintを再生成せず、変更時だけ次generationへ進む", () => {
    const controller = new RecursiveFoldController();
    const first = controller.start("fold://parent", "v1");
    controller.complete("fold://parent", first.run.generation, { boundaryNodeId: "boundary-1", childNodeIds: ["child-1"] });
    expect(controller.start("fold://parent", "v1")).toMatchObject({ accepted: false, reason: "cached-complete" });
    expect(controller.start("fold://parent", "v2")).toMatchObject({ accepted: true, run: { generation: 2 }, previousProjection: { boundaryNodeId: "boundary-1" } });
  });
  it("cancelした旧generationの遅延応答をcompleteにしない", () => {
    const controller = new RecursiveFoldController();
    const run = controller.start("fold://parent", "v1").run;
    expect(controller.cancel("fold://parent")?.controller.signal.aborted).toBe(true);
    expect(controller.complete("fold://parent", run.generation, { boundaryNodeId: "late", childNodeIds: [] })).toBe(false);
  });
  it("fingerprintへ親revisionとprovider/modelを含める", () => {
    expect(recursiveFoldFingerprint({ parentFoldRef: "f", parentRevisionRef: "r1", sourceText: "why", provider: "fixture", model: "m" })).not.toBe(recursiveFoldFingerprint({ parentFoldRef: "f", parentRevisionRef: "r2", sourceText: "why", provider: "fixture", model: "m" }));
  });
});
