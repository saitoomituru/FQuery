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

async function replayFixture(fileName = "nonlinear-fpga-post.json"): Promise<ReplayFixture> {
  const path = new URL(`../../../fixtures/benchmark/${fileName}`, import.meta.url);
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

  it("2026-09-11 live run: Claudeが正本FAM_DECOMPOSITION_RESPONSE_SCHEMA形状で書いた実candidateから、Q拡張のrelations/fold_ref/unknowns/alternative_framingsを抽出する", async () => {
    // candidate-a.claude.fam.jsonはFQuery#45修正後、Gemini live candidate(candidate B)と
    // 同じFAM_DECOMPOSITION_RESPONSE_SCHEMA形状(kind: "decomposition"、λ.output_units[])で
    // 書き直した(validateFamDecomposition()で有効性確認済み)。正本schema自体にはunit間
    // relation/alternative_branches fieldが無いため、Q拡張(open-world additionalProperties)
    // 経由で表現しており、extractTopologyFromFamはそれを見逃さない。
    const fam = await loadCandidateA();
    const { observation, extractionIssueCodes } = extractTopologyFromFam(fam);

    expect(observation.contextDimensionRefs).toEqual([
      "dimension://investment_commitment",
      "dimension://data_center_expansion",
      "dimension://energy_agreement",
    ]);
    expect(observation.foldBoundaryRefs).toEqual(["fold://fam://anthropic/claude-code/google-finland-investment/candidate-a/energy-agreement-fortum-loviisa"]);
    expect(observation.semanticRelations).toEqual([
      { fromRef: "unit-1", toRef: "unit-2", relation: "funds" },
      { fromRef: "unit-1", toRef: "unit-3", relation: "co-occurs-with" },
    ]);
    expect(observation.unknownRefs).toHaveLength(5);
    expect(observation.alternativeBranchRefs).toHaveLength(2);
    expect(extractionIssueCodes).toEqual([
      "canonical-decomposition-schema-has-no-inter-unit-relation-field",
      "canonical-decomposition-schema-has-no-alternative-branches-field",
      "relations-found-via-open-world-Q-extension-not-schema-field",
      "relations-found-via-open-world-Q-extension-not-schema-field",
      "alternative_framings-found-via-open-world-Q-extension-not-schema-field",
    ]);
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
    expect(extractionIssueCodes).toEqual(["nabla-phi-not-a-record", "no-output-units-array-found"]);
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

describe("2026-09-11 live run: google-finland-live (FQuery#45修正後、初のNONLINEAR-GESTALT-EVAL: measured)", () => {
  it("Claude(candidate A)とGemini(candidate B, live gemini-3.5-flash)を非ゼロサムで比較する", async () => {
    const fixture = await replayFixture("nonlinear-google-finland-live.json");
    expect(fixture.observations).toHaveLength(2);
    for (const observation of fixture.observations) {
      expect(validateNonlinearObserverOae(observation)).toEqual({ valid: true, issues: [] });
    }

    const [claude, gemini] = fixture.observations;
    const comparison = compareNonlinearObserverOae(claude!, gemini!);

    // 単一score/winnerへ潰さない
    expect(comparison).not.toHaveProperty("winner");
    expect(comparison).not.toHaveProperty("totalScore");
    expect(comparison.observerVerdicts[0]).not.toBe(comparison.observerVerdicts[1]);

    // 両candidateとも同じ3分割に到達したが、gradient_type labelの文字列は
    // 1件も一致しなかった(同じ構造発見でもlabelが安定しないことの実例)
    expect(comparison.gestaltVector.contextDimensions).toEqual({ intersection: 0, union: 6, ratio: 0 });

    // Claudeはfold_ref抽出とunit間relationsをQ拡張で明示したが、Geminiはどちらも行わなかった
    expect(comparison.gestaltVector.foldBoundaries.ratio).toBe(0);
    expect(comparison.differences.foldBoundaries.onlyRight).toEqual([]);
    expect(comparison.gestaltVector.semanticRelations.ratio).toBe(0);
    expect(comparison.differences.semanticRelations.onlyRight).toEqual([]);

    // ClaudeはunknownsをGeminiより多く明示した(Geminiはunknowns配列はあるが空)
    expect(comparison.differences.unknowns.onlyRight).toEqual([]);
    expect(claude!.topology.unknownRefs.length).toBeGreaterThan(0);
    expect(gemini!.topology.unknownRefs).toEqual([]);

    expect(comparison.issueCodes).toContain("observer-verdict-differs");
    expect(comparison.issueCodes).toContain("topology-observation-differs");
  });

  it("正本schemaのFAM_DECOMPOSITION_RESPONSE_SCHEMAにunit間relation/alternative_branches fieldが無いことを両candidateのissueCodesが記録する", async () => {
    const { observations } = await replayFixture("nonlinear-google-finland-live.json");
    for (const observation of observations) {
      expect(observation.issueCodes).toContain("canonical-decomposition-schema-has-no-inter-unit-relation-field");
      expect(observation.issueCodes).toContain("canonical-decomposition-schema-has-no-alternative-branches-field");
    }
  });
});
