import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  compareNonlinearObserverOae,
  extractTopologyFromFam,
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

describe("extractTopologyFromFam (live comparison用の機械的抽出)", () => {
  async function loadCandidateA(): Promise<unknown> {
    const path = new URL(
      "../../../fixtures/benchmark-raw/nonlinear-google-finland-live/candidate-a.claude.fam.json",
      import.meta.url,
    );
    return JSON.parse(await readFile(path, "utf8"));
  }

  it("2026-09-11 live run: Claudeが生成した実candidateからrelations/fold_ref/unknowns/alternative_branchesを抽出する", async () => {
    const fam = await loadCandidateA();
    const { observation, extractionIssueCodes } = extractTopologyFromFam(fam);

    expect(observation.contextDimensionRefs).toEqual([
      "dimension://investment_commitment",
      "dimension://data_center_expansion",
      "dimension://energy_agreement",
    ]);
    expect(observation.foldBoundaryRefs).toEqual(["fold://fam://google-finland-2026/energy-agreement/fortum-loviisa"]);
    expect(observation.semanticRelations).toEqual([
      { fromRef: "investment_commitment", toRef: "data_center_expansion", relation: "funds" },
      { fromRef: "investment_commitment", toRef: "energy_agreement", relation: "co-occurs-with" },
    ]);
    expect(observation.unknownRefs).toHaveLength(5);
    expect(observation.alternativeBranchRefs).toHaveLength(2);
    expect(extractionIssueCodes).toEqual([]);
  });

  it("relations/unknownsを持たないcandidateは0件を黙って通さずissueCodesへ残す", () => {
    const flatCandidate = { "ψ": {}, "∇φ": { a: {}, b: {} }, "λ": {}, "Q": {} };
    const { observation, extractionIssueCodes } = extractTopologyFromFam(flatCandidate);
    expect(observation.semanticRelations).toEqual([]);
    expect(extractionIssueCodes).toContain("no-explicit-relations-found-despite-multiple-units");
    expect(extractionIssueCodes).toContain("no-unknowns-array-found");
  });

  it("λが非record形状(∇φがrecordでない等)でも例外を投げずunknown抽出failureとして返す", () => {
    const malformed = { "ψ": {}, "∇φ": "not-a-record", "λ": {}, "Q": {} };
    const { observation, extractionIssueCodes } = extractTopologyFromFam(malformed);
    expect(observation).toEqual({ contextDimensionRefs: [], foldBoundaryRefs: [], semanticRelations: [], toolRelations: [], alternativeBranchRefs: [], unknownRefs: [] });
    expect(extractionIssueCodes).toEqual(["nabla-phi-not-a-record"]);
  });

  it("2026-09-11 live run記録: gemini-flash系2 modelが同一schemaで再現した縮退応答は候補として不採用のまま保持する", async () => {
    // fixtures/benchmark-raw/nonlinear-google-finland-live/candidate-b.gemini.degenerate-output.gemini-3.5-flash.json
    // (gemini-flash-latest / gemini-3.5-flash両方で再現)はFQuery自身のvalidateDecomposerCandidate
    // によりprofile-nonconformantとしてrejectされた。extractTopologyFromFamはこの無効candidateへ
    // 適用しない(有効化・救済しない)。詳細はfixtures/benchmark配下のreceiptとFQuery issueを参照。
    const path = new URL(
      "../../../fixtures/benchmark-raw/nonlinear-google-finland-live/candidate-b.gemini.degenerate-output.gemini-3.5-flash.json",
      import.meta.url,
    );
    const raw = JSON.parse(await readFile(path, "utf8")) as { readonly status: string };
    expect(raw.status).toBe("profile-nonconformant");
  });
});
