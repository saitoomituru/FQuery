import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  compareNonlinearObserverOae,
  validateNonlinearObserverOae,
  type NonlinearObserverOae,
} from "../src/index.js";

interface ReplayFixture {
  readonly observations: readonly NonlinearObserverOae[];
}

async function replayFixture(): Promise<ReplayFixture> {
  const path = new URL("../../../fixtures/benchmark/nonlinear-fpga-post.json", import.meta.url);
  return JSON.parse(await readFile(path, "utf8")) as ReplayFixture;
}

describe("nonlinear Observer OAE comparison", () => {
  it("Human、Gemini画面観測、Codex解釈を非ゼロサムrecordとして保持する", async () => {
    const fixture = await replayFixture();
    expect(fixture.observations).toHaveLength(3);
    for (const observation of fixture.observations) {
      expect(validateNonlinearObserverOae(observation)).toEqual({ valid: true, issues: [] });
    }
    expect(new Set(fixture.observations.map((entry) => entry.observerVerdict)).size).toBe(3);
  });

  it("flat fan-outをbase FAM successと混同せず関係edge差分として観測する", async () => {
    const { observations } = await replayFixture();
    const human = observations[0]!;
    const geminiObserved = observations[1]!;
    const comparison = compareNonlinearObserverOae(human, geminiObserved);
    expect(comparison.gestaltVector.semanticRelations).toEqual({ intersection: 0, union: 3, ratio: 0 });
    expect(comparison.differences.semanticRelations.onlyLeft).toHaveLength(3);
    expect(comparison.issueCodes).toContain("topology-observation-differs");
    expect(comparison).not.toHaveProperty("winner");
    expect(comparison).not.toHaveProperty("totalScore");
  });

  it("HumanとCodexの近い読解にもFold境界とedgeの差を残す", async () => {
    const { observations } = await replayFixture();
    const comparison = compareNonlinearObserverOae(observations[0]!, observations[2]!);
    expect(comparison.gestaltVector.contextDimensions.ratio).toBe(1);
    expect(comparison.gestaltVector.foldBoundaries.ratio).toBe(0);
    expect(comparison.gestaltVector.semanticRelations.ratio).toBe(0);
    expect(comparison.observerVerdicts[0]).not.toBe(comparison.observerVerdicts[1]);
  });

  it("異なるsubject revision同士を一つの比較へ混ぜない", async () => {
    const { observations } = await replayFixture();
    const right = { ...observations[1]!, subjectRevisionRef: "revision://other" };
    expect(() => compareNonlinearObserverOae(observations[0]!, right)).toThrow("subject-revision-mismatch");
  });
});
