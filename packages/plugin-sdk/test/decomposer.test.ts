import { describe, expect, it } from "vitest";
import { ManualNlDecomposer, validateDecomposerCandidate, type DecompositionRequest } from "../src/index.js";

const request: DecompositionRequest = {
  requestId: "decompose://test/1",
  queryRef: "q://test/decompose",
  profile: "nl",
  observation: {
    sourceRef: "input://test/source",
    mediaType: "text/plain",
    payload: "雨が降る。傘を持つ。",
    provenance: { claim_scope: "USER_PROVIDED_TEXT" },
  },
  worldRef: "world://test",
  registryRef: "registry://test",
};

describe("Decomposer SPI", () => {
  it("manual NL decomposerをproviderなしで同じSPIへ接続する", () => {
    const outcome = new ManualNlDecomposer().decompose(request);
    expect(outcome.status).toBe("resolved");
    if (outcome.status !== "resolved") throw new Error("resolved expected");
    expect(outcome.fam).toMatchObject({ schema_version: "fam.json/0.1.0-draft", fam_id: "q://test/decompose/fam" });
    expect(outcome.receipt).toMatchObject({ implementationRef: "decomposer://fquery/manual-nl", validationStatus: "accepted" });
    expect(outcome.receipt).not.toHaveProperty("provider");
  });

  it("非対応profileを失敗や不存在へ潰さずunresolvedとLast Orderで返す", () => {
    const outcome = new ManualNlDecomposer().decompose({ ...request, profile: "voice", observation: { ...request.observation, mediaType: "audio/wav" } });
    expect(outcome.status).toBe("unresolved");
    if (outcome.status !== "unresolved") throw new Error("unresolved expected");
    expect(outcome.lastOrder).toMatchObject({ code: "FQUERY-DECOMPOSER-UNRESOLVED", resumeWhen: "compatible-decomposer-available" });
    expect(outcome.receipt.validationStatus).toBe("not-produced");
  });

  it("provider transport後の不正candidateをsemantic successへ昇格しない", () => {
    const outcome = validateDecomposerCandidate(request, { blocks: [] }, {
      implementationRef: "decomposer://test/provider",
      implementationRevision: "1",
      provider: "fixture",
      model: "invalid",
    });
    expect(outcome.status).toBe("rejected");
    if (outcome.status !== "rejected") throw new Error("rejected expected");
    expect(outcome.validationIssues.length).toBeGreaterThan(0);
    expect(outcome.receipt).toMatchObject({ provider: "fixture", model: "invalid", validationStatus: "rejected" });
  });

  it("baseは読めるprofile不適合candidateを手直し用に保持する", () => {
    const candidate = { ψ: "入力", "∇φ": [], λ: {}, Q: null, extra: { retained: true } };
    const outcome = validateDecomposerCandidate(request, candidate, {
      implementationRef: "decomposer://test/provider",
      implementationRevision: "1",
    });
    expect(outcome.status).toBe("profile-nonconformant");
    if (outcome.status !== "profile-nonconformant") throw new Error("profile-nonconformant expected");
    expect(outcome.candidate).toEqual(candidate);
    expect(outcome.receipt).toMatchObject({ baseStructureStatus: "valid", profileConformance: "not-satisfied", validationStatus: "profile-nonconformant" });
  });
});
