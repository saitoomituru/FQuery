import { GoogleGenAI } from "@google/genai";
import { resolveCredential, type CredentialSource } from "@fquery/config";
import type { CapabilityInvocation, CapabilityResult, PluginResolver } from "@fquery/core";
import {
  createAdapterProvenance,
  createUnresolvedDecomposition,
  validateDecomposerCandidate,
  type Decomposer,
  type DecompositionOutcome,
  type DecompositionRequest,
  type PluginManifest,
} from "@fquery/plugin-sdk";
import { FAM_DECOMPOSITION_RESPONSE_SCHEMA, normalizeDecompositionProfileInvariants, validateFamDecomposition, validateFamJson, type FamJsonRecord, type FamValidationResult } from "@fquery/fam-core";

export type GeminiFamCapability = "fam.decompose" | "fam.integrate" | "fam.compare" | "fam.project";
const CAPABILITIES: readonly GeminiFamCapability[] = ["fam.decompose", "fam.integrate", "fam.compare", "fam.project"];

export const geminiPluginManifest: PluginManifest = Object.freeze({
  schemaVersion: "fquery.plugin/0.1.0-draft",
  pluginId: "plugin://fquery/gemini",
  pluginVersion: "0.1.0-draft.0",
  capabilities: CAPABILITIES,
  accepts: ["application/fam+json", "text/plain"],
  returns: ["application/fam+json"],
  authority: { required: false, scopes: [] },
  sideEffect: "network",
  unknownPolicy: "retain",
  lastOrderPolicy: "return-envelope",
  implementation: { language: "typescript", runtime: "node" },
  famSupport: Object.freeze({
    schemaVersion: "fam.adapter-support/0.1.0-draft",
    level: 1,
    capabilityRefs: CAPABILITIES,
    observationSurfaces: ["provider-request", "provider-response", "provider-request-id", "transport-failure"],
    limitations: ["astral-history-not-observed", "model-identity-not-proven", "internal-bus-not-observed"],
  } as const),
});

export interface GeminiGenerateRequest { readonly apiKey: string; readonly model: string; readonly prompt: string; readonly responseSchema: Readonly<Record<string, unknown>>; readonly signal?: AbortSignal }
export interface GeminiGenerateResponse { readonly text: string; readonly requestId?: string }
export type GeminiGenerator = (request: GeminiGenerateRequest) => Promise<GeminiGenerateResponse>;
export interface GeminiModel { readonly name: string; readonly displayName?: string }
export type GeminiModelLister = (apiKey: string) => Promise<readonly GeminiModel[]>;
export interface GeminiPluginOptions { readonly model: string; readonly credentialName: string; readonly credentialSources: readonly CredentialSource[]; readonly generate?: GeminiGenerator }

export async function discoverGeminiModels(apiKey: string, listModels: GeminiModelLister = googleListModels): Promise<readonly GeminiModel[]> {
  return Object.freeze(await listModels(apiKey));
}

export class GeminiFamPlugin implements PluginResolver {
  readonly #options: GeminiPluginOptions;
  constructor(options: GeminiPluginOptions) { this.#options = Object.freeze({ ...options, credentialSources: Object.freeze([...options.credentialSources]) }); }
  async invoke(request: CapabilityInvocation): Promise<CapabilityResult | undefined> {
    if (!CAPABILITIES.includes(request.capability as GeminiFamCapability)) return undefined;
    if (request.sideEffect !== "network") return { pluginId: geminiPluginManifest.pluginId, pluginStatus: "rejected", transportStatus: "failed", reason: "network-side-effect-not-authorized", adapterProvenance: provenance(this.#options.model) };
    const resolved = await resolveCredential({ name: this.#options.credentialName, keyVariable: "GEMINI_API_KEY" }, this.#options.credentialSources);
    if (!resolved?.credential.key) return { pluginId: "plugin://fquery/gemini", transportStatus: "failed", reason: `credential-not-found:${this.#options.credentialName}`, adapterProvenance: provenance(this.#options.model) };
    try {
      const generate = this.#options.generate ?? googleGenerate;
      let response = await generate({ apiKey: resolved.credential.key, model: this.#options.model, prompt: buildPrompt(request), responseSchema: FAM_DECOMPOSITION_RESPONSE_SCHEMA, ...(request.signal ? { signal: request.signal } : {}) });
      let parsed: ParsedFam;
      try {
        parsed = parseFam(response.text);
      } catch (validationError) {
        response = await generate({ apiKey: resolved.credential.key, model: this.#options.model, prompt: buildRepairPrompt(request, validationError), responseSchema: FAM_DECOMPOSITION_RESPONSE_SCHEMA, ...(request.signal ? { signal: request.signal } : {}) });
        try {
          parsed = parseFam(response.text);
        } catch (repairValidationError) {
          return { pluginId: geminiPluginManifest.pluginId, transportStatus: "succeeded", outputStatus: "invalid", reason: errorReason(repairValidationError, resolved.credential.key, "gemini-output-invalid"), adapterProvenance: provenance(this.#options.model), execution: { provider: "google", model: this.#options.model, pluginVersion: geminiPluginManifest.pluginVersion, credentialName: resolved.credential.name, ...(response.requestId ? { requestId: response.requestId } : {}) } };
        }
      }
      if (!parsed.validation.valid) {
        return {
          pluginId: geminiPluginManifest.pluginId,
          transportStatus: "succeeded",
          outputStatus: "profile-nonconformant",
          candidate: parsed.value,
          reason: "decomposition-profile-nonconformant",
          profileValidation: toProfileValidation(parsed.validation),
          evidenceRefs: [],
          adapterProvenance: provenance(this.#options.model),
          ...generationProfileReceipts(request),
          ...(parsed.repairedPaths.length > 0 ? { normalization: { profileRef: parsed.profileRef, repairedPaths: parsed.repairedPaths } } : {}),
          execution: { provider: "google", model: this.#options.model, pluginVersion: geminiPluginManifest.pluginVersion, credentialName: resolved.credential.name, ...(response.requestId ? { requestId: response.requestId } : {}) },
        };
      }
      return { pluginId: geminiPluginManifest.pluginId, transportStatus: "succeeded", outputStatus: "accepted", value: parsed.value, evidenceRefs: [], adapterProvenance: provenance(this.#options.model), ...generationProfileReceipts(request), ...(parsed.repairedPaths.length > 0 ? { normalization: { profileRef: parsed.profileRef, repairedPaths: parsed.repairedPaths } } : {}), execution: { provider: "google", model: this.#options.model, pluginVersion: geminiPluginManifest.pluginVersion, credentialName: resolved.credential.name, ...(response.requestId ? { requestId: response.requestId } : {}) } };
    } catch (error) {
      return { pluginId: geminiPluginManifest.pluginId, transportStatus: "failed", reason: errorReason(error, resolved.credential.key, "gemini-call-failed"), adapterProvenance: provenance(this.#options.model), execution: { provider: "google", model: this.#options.model, pluginVersion: geminiPluginManifest.pluginVersion, credentialName: resolved.credential.name } };
    }
  }
}

function provenance(model: string) {
  return createAdapterProvenance(geminiPluginManifest, {
    providerRef: "provider://google/gemini",
    modelRef: `model://google/${model}`,
    runtimeRef: "runtime://google/gemini-api",
  });
}

export class GeminiNlDecomposer implements Decomposer {
  readonly implementationRef = "decomposer://fquery/gemini-nl";
  readonly implementationRevision = geminiPluginManifest.pluginVersion;
  readonly profiles = Object.freeze(["nl"] as const);
  readonly #plugin: GeminiFamPlugin;
  readonly #model: string;

  constructor(options: GeminiPluginOptions) {
    this.#plugin = new GeminiFamPlugin(options);
    this.#model = options.model;
  }

  async decompose(request: DecompositionRequest): Promise<DecompositionOutcome> {
    if (request.profile !== "nl" || request.observation.mediaType !== "text/plain" || typeof request.observation.payload !== "string") {
      return createUnresolvedDecomposition(request, this, "unsupported-observation-profile", "select-compatible-decomposer", "compatible-decomposer-available");
    }
    const result = await this.#plugin.invoke({ queryRef: request.queryRef, capability: "fam.decompose", input: request.observation.payload, sideEffect: "network" });
    if (!result || result.transportStatus !== "succeeded") {
      return createUnresolvedDecomposition(request, { ...this, provider: "google", model: this.#model }, result?.reason ?? "provider-route-unavailable", "inspect-provider-or-select-another-route", "provider-route-available");
    }
    return validateDecomposerCandidate(request, result.value, { ...this, provider: "google", model: this.#model });
  }
}

async function googleGenerate(request: GeminiGenerateRequest): Promise<GeminiGenerateResponse> {
  const client = new GoogleGenAI({ apiKey: request.apiKey });
  const response = await client.models.generateContent({ model: request.model, contents: request.prompt, config: { responseMimeType: "application/json", responseJsonSchema: request.responseSchema, ...(request.signal ? { abortSignal: request.signal } : {}) } });
  if (!response.text) throw new Error("gemini-empty-response");
  return { text: response.text, ...(response.responseId ? { requestId: response.responseId } : {}) };
}

function errorReason(error: unknown, credential: string, fallback: string): string {
  const raw = error instanceof Error ? error.message : fallback;
  return raw
    .replaceAll(credential, "[REDACTED]")
    .replace(/(authorization|x-goog-api-key)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .slice(0, 2_000);
}

async function googleListModels(apiKey: string): Promise<readonly GeminiModel[]> {
  const client = new GoogleGenAI({ apiKey });
  const pager = await client.models.list({ config: { pageSize: 100, queryBase: true, abortSignal: AbortSignal.timeout(15_000) } });
  return pager.page.flatMap((model): GeminiModel[] => {
    const name = model.name?.replace(/^models\//, "");
    if (!name?.startsWith("gemini-") || !model.supportedActions?.includes("generateContent")) return [];
    return [Object.freeze({ name, ...(model.displayName ? { displayName: model.displayName } : {}) })];
  });
}

function buildPrompt(request: CapabilityInvocation): string {
  return JSON.stringify({ proton_profile: "proton://fquery/fam-json-core@0.1.0-draft", capability: request.capability, source: request.input, ref_profiles: request.profileBindings ?? [], instruction: "Return one fam.json/0.1.0-draft record. Apply every ref_profiles entry whose roles contains generation-constraint using exactly its profileRef and revisionRef; do not invent an undeclared hierarchy, World, Perspective, authority, causality, or boundary rule. Preserve the input context, language mixture, code blocks, identifiers, ordering, and semantic relations. Do not normalize Japanese, English, C, or another register into one language. Unless the request explicitly asks for translation, output the same language and code registers as the corresponding input context; contextual equivalence is required but byte identity is not. Set λ.purpose exactly to the machine token source-decomposition. Every output unit must include ψ, ∇φ, λ, and Q with non-empty source/manifestation language metadata and Observer/Registry/fact-scope/unknown fields. Every Q.unknowns item is {source_expression:<context-preserving expression>,source_language:<declared language or mixed-language tag>,concept_id:<machine identifier>}. If a ref profile declares semantic_topology_contract, use its branches_pointer and field mapping to preserve supported L/mL relations as one or more non-zero-sum branches; emit the selected_branch_ref only when supported, keep alternatives, and omit topology rather than flattening or inventing it when indeterminate. Keep provenance structured. Classification may be wrong and remain editable; do not claim context or hash verification unless a verifier profile actually provides a receipt. Do not return blocks[], RPC/MCP envelopes, FAMLog, or transport events." });
}

function buildRepairPrompt(request: CapabilityInvocation, error: unknown): string {
  return `${buildPrompt(request)}\nThe previous candidate was rejected by the FAM validator. Return a complete replacement, not a patch. Validator findings: ${error instanceof Error ? error.message : "invalid-fam-json"}`;
}

function generationProfileReceipts(request: CapabilityInvocation): Pick<CapabilityResult, "profileReceipts"> {
  const receipts = request.profileBindings?.filter((binding) => binding.roles.includes("generation-constraint")).map((binding) => Object.freeze({ profileRef: binding.profileRef, revisionRef: binding.revisionRef, appliedStages: Object.freeze(["generation-constraint"] as const) })) ?? [];
  return receipts.length > 0 ? { profileReceipts: Object.freeze(receipts) } : {};
}

interface ParsedFam { readonly value: FamJsonRecord; readonly repairedPaths: readonly string[]; readonly profileRef: string; readonly validation: FamValidationResult }

function parseFam(text: string): ParsedFam {
  const candidate = JSON.parse(text) as FamJsonRecord;
  const base = validateFamJson(candidate);
  if (!base.valid) throw new TypeError(`invalid-fam-base:${base.issues.map((entry) => `${entry.path}:${entry.code}`).join(",")}`);
  const normalized = normalizeDecompositionProfileInvariants(candidate);
  const validation = validateFamDecomposition(normalized.value);
  return Object.freeze({ ...normalized, validation });
}

function toProfileValidation(validation: FamValidationResult) {
  return Object.freeze({
    baseStructureStatus: validation.baseStructureStatus,
    profileConformance: validation.profileConformance,
    ...(validation.profileRef ? { profileRef: validation.profileRef } : {}),
    issues: Object.freeze(validation.issues.map((entry) => Object.freeze({ path: entry.path, code: entry.code, message: entry.message }))),
  });
}
