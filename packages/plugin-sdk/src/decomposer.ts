import {
  createLiteralDecompositionFam,
  stampDecompositionUnitIdentity,
  validateFamJson,
  validateFamDecomposition,
  type FamJsonRecord,
  type FamValidationIssue,
} from "@fquery/fam-core";

export type ObservationProfile = "nl" | "voice" | "video" | "sensor" | (string & {});

export interface RawObservation {
  readonly sourceRef: string;
  readonly payload: unknown;
  readonly mediaType: string;
  readonly provenance?: Readonly<Record<string, unknown>>;
}

export interface DecompositionRequest {
  readonly requestId: string;
  readonly queryRef: string;
  readonly profile: ObservationProfile;
  readonly observation: RawObservation;
  readonly worldRef?: string;
  readonly registryRef?: string;
}

export interface DecompositionReceipt {
  readonly schemaVersion: "fquery.decomposition-receipt/0.1.0-draft";
  readonly requestId: string;
  readonly sourceRef: string;
  readonly profile: ObservationProfile;
  readonly implementationRef: string;
  readonly implementationRevision: string;
  readonly provider?: string;
  readonly model?: string;
  readonly validationStatus: "accepted" | "profile-nonconformant" | "rejected" | "not-produced";
  readonly baseStructureStatus: "valid" | "invalid" | "not-evaluated";
  readonly profileConformance: "satisfied" | "not-satisfied" | "not-evaluable" | "not-evaluated";
}

export type DecompositionOutcome =
  | { readonly status: "resolved"; readonly fam: FamJsonRecord; readonly receipt: DecompositionReceipt }
  | { readonly status: "profile-nonconformant"; readonly candidate: unknown; readonly reason: string; readonly validationIssues: readonly FamValidationIssue[]; readonly receipt: DecompositionReceipt }
  | {
      readonly status: "unresolved";
      readonly unknowns: readonly string[];
      readonly lastOrder: { readonly code: string; readonly reason: string; readonly requestedNext: string; readonly resumeWhen: string };
      readonly receipt: DecompositionReceipt;
    }
  | { readonly status: "rejected"; readonly reason: string; readonly validationIssues: readonly FamValidationIssue[]; readonly receipt: DecompositionReceipt };

export interface Decomposer {
  readonly implementationRef: string;
  readonly implementationRevision: string;
  readonly profiles: readonly ObservationProfile[];
  decompose(request: DecompositionRequest): Promise<DecompositionOutcome> | DecompositionOutcome;
}

export interface DecomposerCandidateMetadata {
  readonly implementationRef: string;
  readonly implementationRevision: string;
  readonly provider?: string;
  readonly model?: string;
}

export function validateDecomposerCandidate(
  request: DecompositionRequest,
  candidate: unknown,
  metadata: DecomposerCandidateMetadata,
): DecompositionOutcome {
  const identifiedCandidate = candidate && typeof candidate === "object" && !Array.isArray(candidate) && (candidate as { kind?: unknown }).kind === "decomposition"
    ? stampDecompositionUnitIdentity(candidate as FamJsonRecord)
    : candidate;
  const base = validateFamJson(identifiedCandidate);
  const validation = validateFamDecomposition(identifiedCandidate);
  const validationStatus = validation.valid ? "accepted" : base.valid ? "profile-nonconformant" : "rejected";
  const receipt = createReceipt(request, metadata, validationStatus, base.baseStructureStatus, validation.profileConformance);
  if (!validation.valid) {
    if (base.valid) {
      return Object.freeze({
        status: "profile-nonconformant",
        candidate: identifiedCandidate,
        reason: "decomposition-profile-nonconformant",
        validationIssues: Object.freeze([...validation.issues]),
        receipt,
      });
    }
    return Object.freeze({
      status: "rejected",
      reason: "fam-validation-failed",
      validationIssues: Object.freeze([...validation.issues]),
      receipt,
    });
  }
  return Object.freeze({ status: "resolved", fam: identifiedCandidate as FamJsonRecord, receipt });
}

export class ManualNlDecomposer implements Decomposer {
  readonly implementationRef = "decomposer://fquery/manual-nl";
  readonly implementationRevision = "0.1.0-draft.0";
  readonly profiles = Object.freeze(["nl"] as const);

  decompose(request: DecompositionRequest): DecompositionOutcome {
    if (request.profile !== "nl" || request.observation.mediaType !== "text/plain") {
      return createUnresolvedDecomposition(request, this, "unsupported-observation-profile", "select-compatible-decomposer", "compatible-decomposer-available");
    }
    if (typeof request.observation.payload !== "string" || request.observation.payload.trim().length === 0) {
      return createUnresolvedDecomposition(request, this, "source-text-unavailable", "provide-source-text", "source-text-available");
    }
    const fam = createLiteralDecompositionFam(request.observation.payload, request.queryRef);
    return validateDecomposerCandidate(request, fam, this);
  }
}

export function createUnresolvedDecomposition(
  request: DecompositionRequest,
  metadata: DecomposerCandidateMetadata,
  reason: string,
  requestedNext: string,
  resumeWhen: string,
): DecompositionOutcome {
  return Object.freeze({
    status: "unresolved",
    unknowns: Object.freeze([reason]),
    lastOrder: Object.freeze({ code: "FQUERY-DECOMPOSER-UNRESOLVED", reason, requestedNext, resumeWhen }),
    receipt: createReceipt(request, metadata, "not-produced"),
  });
}

function createReceipt(
  request: DecompositionRequest,
  metadata: DecomposerCandidateMetadata,
  validationStatus: DecompositionReceipt["validationStatus"],
  baseStructureStatus: DecompositionReceipt["baseStructureStatus"] = validationStatus === "not-produced" ? "not-evaluated" : validationStatus === "rejected" ? "invalid" : "valid",
  profileConformance: DecompositionReceipt["profileConformance"] = validationStatus === "accepted" ? "satisfied" : validationStatus === "profile-nonconformant" ? "not-satisfied" : validationStatus === "rejected" ? "not-evaluable" : "not-evaluated",
): DecompositionReceipt {
  return Object.freeze({
    schemaVersion: "fquery.decomposition-receipt/0.1.0-draft",
    requestId: request.requestId,
    sourceRef: request.observation.sourceRef,
    profile: request.profile,
    implementationRef: metadata.implementationRef,
    implementationRevision: metadata.implementationRevision,
    ...(metadata.provider ? { provider: metadata.provider } : {}),
    ...(metadata.model ? { model: metadata.model } : {}),
    validationStatus,
    baseStructureStatus,
    profileConformance,
  });
}
