import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  normalizeFamTopology,
  planParallelFold,
  projectTopologyForPresentation,
  projectTopologyForRunner,
  requiredAdapterCapabilities,
  validateAdapterCapabilities,
} from "../src/index.js";

async function sample(name: string): Promise<unknown> {
  return JSON.parse(await readFile(new URL(`../../../sample/${name}`, import.meta.url), "utf8"));
}

describe("TopologyからのRunner / Presentation投影", () => {
  it("sample2の同じTopology revisionからmL dependencyと表示edgeを投影する", async () => {
    const topology = normalizeFamTopology({
      moduleRef: "fam://sample/2",
      revisionRef: "revision://sample/2/1",
      foldRef: "fold://sample/2",
      value: await sample("sample2.fam.json"),
    });
    const byAddress = new Map(topology.nodes.filter((node) => node.addressKey).map((node) => [node.addressKey, node]));
    const runner = projectTopologyForRunner(topology);
    const presentation = projectTopologyForPresentation(topology);

    expect(runner.sourceTopologyRef).toBe(presentation.sourceTopologyRef);
    expect(runner.revisionRef).toBe("revision://sample/2/1");
    expect(runner.executionAuthorized).toBe(false);
    expect(runner.children).toEqual([
      { childRef: byAddress.get("fact")!.nodeRef, dependsOn: [], status: "ready" },
      { childRef: byAddress.get("anxiety")!.nodeRef, dependsOn: [byAddress.get("fact")!.nodeRef], status: "ready" },
      { childRef: byAddress.get("umbrella")!.nodeRef, dependsOn: [byAddress.get("anxiety")!.nodeRef], status: "ready" },
    ]);
    expect(planParallelFold("resolved", runner.children).waves).toEqual([
      [byAddress.get("fact")!.nodeRef],
      [byAddress.get("anxiety")!.nodeRef],
      [byAddress.get("umbrella")!.nodeRef],
    ]);
    expect(presentation.canonicalSemanticState).toBe(false);
    expect(presentation.edges.filter((edge) => edge.kind === "runtime")).toHaveLength(2);
    expect(presentation.edges.every((edge) => topology.edges.some((source) => source.edgeRef === edge.edgeRef))).toBe(true);
  });

  it("sample1のarray indexをRunner依存へ自動昇格しない", async () => {
    const topology = normalizeFamTopology({
      moduleRef: "fam://sample/1",
      revisionRef: "revision://sample/1/1",
      foldRef: "fold://sample/1",
      value: await sample("sample1.fam.json"),
    });
    const runner = projectTopologyForRunner(topology);

    expect(runner.children).toHaveLength(3);
    expect(runner.children.every((child) => child.dependsOn.length === 0)).toBe(true);
    expect(planParallelFold("resolved", runner.children).waves).toEqual([
      [...runner.children.map((child) => child.childRef)].sort(),
    ]);
  });
});

describe("objective fact / subjective truth adapter capability", () => {
  it("objective factはfact取得と検証可能provenanceを要求する", () => {
    expect(requiredAdapterCapabilities("objective-fact")).toEqual(["fact-retrieval", "verifiable-provenance"]);
    expect(validateAdapterCapabilities("objective-fact", ["fact-retrieval", "verifiable-provenance"])).toEqual({
      truthKind: "objective-fact",
      compatibilityStatus: "compatible",
      requiredCapabilities: ["fact-retrieval", "verifiable-provenance"],
      missingCapabilities: [],
      retrievalStatus: "not-started",
      adoptionStatus: "not-evaluated",
    });
    expect(validateAdapterCapabilities("objective-fact", ["semantic-retrieval", "interpretation-candidates"])).toMatchObject({
      compatibilityStatus: "incompatible",
      missingCapabilities: ["fact-retrieval", "verifiable-provenance"],
      adoptionStatus: "not-evaluated",
    });
  });

  it("subjective truthはsemantic候補を要求しobjective universalへ昇格しない", () => {
    expect(requiredAdapterCapabilities("subjective-truth")).toEqual(["semantic-retrieval", "interpretation-candidates"]);
    expect(validateAdapterCapabilities("subjective-truth", ["semantic-retrieval", "interpretation-candidates"])).toMatchObject({
      compatibilityStatus: "compatible",
      retrievalStatus: "not-started",
      adoptionStatus: "not-evaluated",
    });
    expect(validateAdapterCapabilities("subjective-truth", ["fact-retrieval", "verifiable-provenance"])).toMatchObject({
      compatibilityStatus: "incompatible",
      missingCapabilities: ["semantic-retrieval", "interpretation-candidates"],
    });
  });
});
