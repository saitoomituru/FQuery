import { describe, expect, it } from "vitest";
import type { OaeConstraintEvaluationReceipt } from "@fquery/core";
import { validateOaeConstraintEvaluationReceipt } from "../src/index.js";

const receipt = (observerRef: string, verdict: string): OaeConstraintEvaluationReceipt => ({
  subjectRef: "fam://subject",
  subjectRevisionRef: "rev://subject/1",
  observerRef,
  observerDomainRef: "domain://observer/test",
  ruleRef: "rule://test/oae",
  ruleRevisionRef: "rev://rule/1",
  candidateRecordRef: "oae-candidate://test/1",
  candidateRecordRevisionRef: "rev://oae-candidate/1",
  evaluatorRef: "evaluator://test/plugin",
  evaluatorRevisionRef: "rev://evaluator/1",
  recordIntegrity: "valid",
  ruleConformance: "satisfied",
  observerVerdict: verdict,
  evidenceRefs: [],
  issueCodes: [],
});

describe("OAE evaluator adapter helper", () => {
  it("相反するObserver verdictをそれぞれ有効なrecordとして扱える", () => {
    expect(validateOaeConstraintEvaluationReceipt(receipt("observer://team-a", "matched")).valid).toBe(true);
    expect(validateOaeConstraintEvaluationReceipt(receipt("observer://team-b", "not-matched")).valid).toBe(true);
  });

  it("evaluator固有の状態整合をCore外で評価する", () => {
    expect(validateOaeConstraintEvaluationReceipt({ ...receipt("observer://team-a", "matched"), recordIntegrity: "invalid" }).issues)
      .toContain("oae-constraint-invalid-record-cannot-satisfy-rule");
    expect(validateOaeConstraintEvaluationReceipt({ ...receipt("observer://team-a", "indeterminate"), ruleConformance: "not-evaluable" }).issues)
      .toContain("oae-constraint-not-evaluable-reason-required");
  });
});
