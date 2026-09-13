import { fileURLToPath } from "node:url";
import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { evaluateQ } from "@fquery/core";
import { compileQCall, extractQCalls, resolveQForCall, type FamTreeNode } from "@fquery/plugin-sdk";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StdioFamPlugin } from "../src/index.js";

const refFamDir = fileURLToPath(new URL("../../../refFAM/", import.meta.url));
const atlantisCommons = JSON.parse(
  readFileSync(new URL("../../../refFAM/AtlantisCommons.refFAM.json", import.meta.url), "utf8"),
) as FamTreeNode;

describe("StdioFamPlugin.invoke (file.fit)", () => {
  it("world/*.reffam.jsonへ実際にglob+読み込みを行いbase構造検証結果込みで返す", async () => {
    const plugin = new StdioFamPlugin({ baseDir: refFamDir });
    const result = await plugin.invoke({
      queryRef: "q://test/world-fit",
      capability: "file.fit",
      input: ["world/*.reffam.json"],
      sideEffect: "read",
    });
    expect(result?.transportStatus).toBe("succeeded");
    const matches = result?.value as { matchedPath: string; baseStructureStatus: string }[];
    expect(matches).toHaveLength(3);
    expect(matches.every((match) => match.baseStructureStatus === "valid")).toBe(true);
    expect(matches.map((m) => m.matchedPath).sort()).toEqual([
      `${refFamDir}world/dev.reffam.json`,
      `${refFamDir}world/intelligence.reffam.json`,
      `${refFamDir}world/tera.reffam.json`,
    ]);
  });

  it("マッチ0件はエラーではなく空配列succeededとして返る", async () => {
    const plugin = new StdioFamPlugin({ baseDir: refFamDir });
    const result = await plugin.invoke({
      queryRef: "q://test/no-match",
      capability: "file.fit",
      input: ["nonexistent-dir/*.reffam.json"],
      sideEffect: "read",
    });
    expect(result?.transportStatus).toBe("succeeded");
    expect(result?.value).toEqual([]);
  });

  it("read以外のsideEffectはrejectする", async () => {
    const plugin = new StdioFamPlugin({ baseDir: refFamDir });
    const result = await plugin.invoke({
      queryRef: "q://test/network-denied",
      capability: "file.fit",
      input: ["world/*.reffam.json"],
      sideEffect: "network",
    });
    expect(result?.pluginStatus).toBe("rejected");
    expect(result?.reason).toBe("read-side-effect-not-authorized");
  });

  it("file.fit以外のcapabilityにはundefinedを返す(PluginResolver規約)", async () => {
    const plugin = new StdioFamPlugin({ baseDir: refFamDir });
    const result = await plugin.invoke({ queryRef: "q://test/other", capability: "prompt", input: "x", sideEffect: "read" });
    expect(result).toBeUndefined();
  });
});

describe("StdioFamPlugin.invoke (file.write)", () => {
  let writeDir: string;

  beforeEach(() => {
    writeDir = mkdtempSync(join(tmpdir(), "fquery-stdio-write-test-"));
  });

  afterEach(() => {
    rmSync(writeDir, { recursive: true, force: true });
  });

  it("指定pathへFAM JSONを書き込み、file.fitで読み返せる", async () => {
    const plugin = new StdioFamPlugin({ baseDir: writeDir });
    const fam = { ψ: "written-by-test", "∇φ": {}, λ: "stub", Q: {} };
    const writeResult = await plugin.invoke({
      queryRef: "q://test/write",
      capability: "file.write",
      input: { path: "written/sample.reffam.json", fam },
      sideEffect: "write",
    });
    expect(writeResult?.transportStatus).toBe("succeeded");

    const fitResult = await plugin.invoke({
      queryRef: "q://test/write-then-fit",
      capability: "file.fit",
      input: ["written/*.reffam.json"],
      sideEffect: "read",
    });
    const matches = fitResult?.value as { fam: unknown }[];
    expect(matches).toHaveLength(1);
    expect(matches[0]!.fam).toEqual(fam);
  });

  it("baseDir外へのpath traversalは書き込まずrejectする", async () => {
    const plugin = new StdioFamPlugin({ baseDir: writeDir });
    const result = await plugin.invoke({
      queryRef: "q://test/write-traversal",
      capability: "file.write",
      input: { path: "../../etc/escaped.json", fam: { ψ: "x", "∇φ": {}, λ: "x", Q: {} } },
      sideEffect: "write",
    });
    expect(result?.pluginStatus).toBe("rejected");
    expect(result?.reason).toBe("path-traversal-outside-base-dir-rejected");
  });

  it("write以外のsideEffectはrejectする", async () => {
    const plugin = new StdioFamPlugin({ baseDir: writeDir });
    const result = await plugin.invoke({
      queryRef: "q://test/write-wrong-side-effect",
      capability: "file.write",
      input: { path: "sample.reffam.json", fam: {} },
      sideEffect: "read",
    });
    expect(result?.pluginStatus).toBe("rejected");
    expect(result?.reason).toBe("write-side-effect-not-authorized");
  });

  it("pathまたはfamが欠けている入力はrejectする", async () => {
    const plugin = new StdioFamPlugin({ baseDir: writeDir });
    const result = await plugin.invoke({
      queryRef: "q://test/write-missing-fields",
      capability: "file.write",
      input: { path: "" },
      sideEffect: "write",
    });
    expect(result?.pluginStatus).toBe("rejected");
    expect(result?.reason).toBe("file-write-input-must-have-path-and-fam");
  });
});

describe("end-to-end: AtlantisCommons.refFAM.json G7 World -> evaluateQ() -> 実file読み込み", () => {
  it("Q(self).file.fitが実際にworld/配下3ファイルを取り寄せてFAMとして返す", async () => {
    const g7 = (atlantisCommons["∇φ"] as Record<string, FamTreeNode>)["G7 World"]!["∇φ"] as Record<string, unknown>;
    const [call] = extractQCalls(g7);
    expect(call).toBeDefined();

    const effectiveQ = resolveQForCall(atlantisCommons, ["G7 World"], call!);
    const compiled = compileQCall(call!, effectiveQ, { queryId: "q://test/g7-real-file-fit" });
    if (compiled.status === "bottom") throw new Error(`expected resolved but got bottom: ${JSON.stringify(compiled.lastOrder)}`);
    const { queryNode, profileBindings } = compiled.value;

    const plugin = new StdioFamPlugin({ baseDir: refFamDir });
    const result = await evaluateQ(queryNode, { pluginResolver: plugin, profileBindings });
    expect(result.pluginStatus).toBe("resolved");
    expect(result.transportStatus).toBe("succeeded");
    const matches = result.value as { matchedPath: string }[];
    expect(matches).toHaveLength(3);
  });
});
