import { describe, expect, it } from "vitest";
import { validateOaeConstraintEvaluationReceipt, type OaeConstraintEvaluationReceipt } from "../src/index.js";

const receipt = (observerRef: string, verdict: string): OaeConstraintEvaluationReceipt => ({
  subjectRef: "fam://test/hypothesis-h",
  subjectRevisionRef: "rev://test/hypothesis-h/7",
  observerRef,
  observerDomainRef: "domain://test/scientific-replication",
  ruleRef: "rule://test/scientific-replication",
  ruleRevisionRef: "rev://test/scientific-replication/2",
  candidateRecordRef: `oae://test/${observerRef.split("/").at(-1)}`,
  candidateRecordRevisionRef: `rev://test/oae/${observerRef.split("/").at(-1)}/1`,
  evaluatorRef: "plugin://test/oae-rule-evaluator",
  evaluatorRevisionRef: "rev://test/oae-rule-evaluator/1",
  recordIntegrity: "valid",
  ruleConformance: "satisfied",
  observerVerdict: verdict,
  evidenceRefs: ["experiment://test/run-42"],
  issueCodes: [],
});

describe("OAE拘束評価receipt", () => {
  it("相反するobserver verdictをどちらも有効なrecordとして保持する", () => {
    expect(validateOaeConstraintEvaluationReceipt(receipt("observer://team-a", "matched")).valid).toBe(true);
    expect(validateOaeConstraintEvaluationReceipt(receipt("observer://team-b", "not-matched")).valid).toBe(true);
  });

  it("invalid recordをrule satisfiedへ昇格させない", () => {
    expect(validateOaeConstraintEvaluationReceipt({ ...receipt("observer://team-a", "matched"), recordIntegrity: "invalid" }).issues)
      .toContain("oae-constraint-invalid-record-cannot-satisfy-rule");
  });

  it("評価不能には理由を要求する", () => {
    expect(validateOaeConstraintEvaluationReceipt({ ...receipt("observer://team-a", "indeterminate"), ruleConformance: "not-evaluable" }).issues)
      .toContain("oae-constraint-not-evaluable-reason-required");
  });
});
