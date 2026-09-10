export type FQueryTruthKind = "objective-fact" | "subjective-truth";

export type FQueryAdapterCapability =
  | "fact-retrieval"
  | "verifiable-provenance"
  | "semantic-retrieval"
  | "interpretation-candidates";

export interface AdapterCapabilityValidation {
  readonly truthKind: FQueryTruthKind;
  readonly compatibilityStatus: "compatible" | "incompatible";
  readonly requiredCapabilities: readonly FQueryAdapterCapability[];
  readonly missingCapabilities: readonly FQueryAdapterCapability[];
  readonly retrievalStatus: "not-started";
  readonly adoptionStatus: "not-evaluated";
}

/** backend製品名を固定せず、問い合わせ種別から必要能力だけを返す。 */
export function requiredAdapterCapabilities(truthKind: FQueryTruthKind): readonly FQueryAdapterCapability[] {
  return truthKind === "objective-fact"
    ? Object.freeze(["fact-retrieval", "verifiable-provenance"])
    : Object.freeze(["semantic-retrieval", "interpretation-candidates"]);
}

/** retrievedとadoptedを分離したままadapter申告能力との互換性だけを検証する。 */
export function validateAdapterCapabilities(
  truthKind: FQueryTruthKind,
  availableCapabilities: readonly FQueryAdapterCapability[],
): AdapterCapabilityValidation {
  const required = requiredAdapterCapabilities(truthKind);
  const available = new Set(availableCapabilities);
  const missing = required.filter((capability) => !available.has(capability));
  return Object.freeze({
    truthKind,
    compatibilityStatus: missing.length === 0 ? "compatible" : "incompatible",
    requiredCapabilities: required,
    missingCapabilities: Object.freeze(missing),
    retrievalStatus: "not-started",
    adoptionStatus: "not-evaluated",
  });
}
