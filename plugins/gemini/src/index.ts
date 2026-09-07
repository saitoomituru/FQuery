import { GoogleGenAI } from "@google/genai";
import { resolveCredential, type CredentialSource } from "@fquery/config";
import type { CapabilityInvocation, CapabilityResult, PluginResolver } from "@fquery/core";
import type { PluginManifest } from "@fquery/plugin-sdk";
import { FAM_JSON_RESPONSE_SCHEMA, inferSourceLanguage, validateFamDecomposition } from "@fquery/fam-core";

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
});

export interface GeminiGenerateRequest { readonly apiKey: string; readonly model: string; readonly prompt: string; readonly responseSchema: Readonly<Record<string, unknown>> }
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
    if (request.sideEffect !== "network") return { pluginId: geminiPluginManifest.pluginId, pluginStatus: "rejected", transportStatus: "failed", reason: "network-side-effect-not-authorized" };
    const resolved = await resolveCredential({ name: this.#options.credentialName, keyVariable: "GEMINI_API_KEY" }, this.#options.credentialSources);
    if (!resolved?.credential.key) return { pluginId: "plugin://fquery/gemini", transportStatus: "failed", reason: `credential-not-found:${this.#options.credentialName}` };
    try {
      const generate = this.#options.generate ?? googleGenerate;
      let response = await generate({ apiKey: resolved.credential.key, model: this.#options.model, prompt: buildPrompt(request), responseSchema: FAM_JSON_RESPONSE_SCHEMA });
      let fam: unknown;
      try {
        fam = parseFam(response.text);
      } catch (validationError) {
        response = await generate({ apiKey: resolved.credential.key, model: this.#options.model, prompt: buildRepairPrompt(request, validationError), responseSchema: FAM_JSON_RESPONSE_SCHEMA });
        fam = parseFam(response.text);
      }
      return { pluginId: geminiPluginManifest.pluginId, transportStatus: "succeeded", value: fam, evidenceRefs: [], execution: { provider: "google", model: this.#options.model, pluginVersion: geminiPluginManifest.pluginVersion, credentialName: resolved.credential.name, ...(response.requestId ? { requestId: response.requestId } : {}) } };
    } catch (error) {
      return { pluginId: geminiPluginManifest.pluginId, transportStatus: "failed", reason: error instanceof Error ? error.message : "gemini-call-failed", execution: { provider: "google", model: this.#options.model, pluginVersion: geminiPluginManifest.pluginVersion, credentialName: resolved.credential.name } };
    }
  }
}

async function googleGenerate(request: GeminiGenerateRequest): Promise<GeminiGenerateResponse> {
  const client = new GoogleGenAI({ apiKey: request.apiKey });
  const response = await client.models.generateContent({ model: request.model, contents: request.prompt, config: { responseMimeType: "application/json", responseJsonSchema: request.responseSchema } });
  if (!response.text) throw new Error("gemini-empty-response");
  return { text: response.text, ...(response.responseId ? { requestId: response.responseId } : {}) };
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
  const sourceLanguageHint = inferSourceLanguage(request.input);
  const translationTarget = sourceLanguageHint === "en" ? "ja" : "en";
  return JSON.stringify({ proton_profile: "proton://fquery/fam-json-core@0.1.0-draft", capability: request.capability, source: request.input, source_language_hint: sourceLanguageHint, translation_target: translationTarget, instruction: "Return one fam.json/0.1.0-draft record. The input language is the canonical origin language: never replace its title, index_subjects, Q.unknowns, ψ, ∇φ source_expression, or λ manifestation with a translation. Set λ.purpose exactly to the machine token source-decomposition. Set title_language and every source_language/manifestation_language consistently. λ.output_units must cover the complete source in original order without omission or duplication. Each output unit must preserve an exact source substring in ψ.source_text, every ∇φ[*].source_expression, and λ.manifestation, and must include Observer/Registry/fact-scope/unknown Q fields. Put other-language natural-language text only in λ.sub_splitters as a nested ψ/∇φ/λ/Q translation-witness FAM. Its ψ retains the canonical source text plus source_language and target_language; its λ.manifestation is the translation and manifestation_language equals target_language; its Q contains copy_role=translation-witness, source_node_ref, unknowns, unknown_is_absence=false, and translation_error={status:not-evaluated,metric_refs:[],measurements:[]}. Keep provenance structured and do not add other-language prose there. Do not return blocks[], RPC/MCP envelopes, FAMLog, or transport events." });
}

function buildRepairPrompt(request: CapabilityInvocation, error: unknown): string {
  return `${buildPrompt(request)}\nThe previous candidate was rejected by the FAM validator. Return a complete replacement, not a patch. Validator findings: ${error instanceof Error ? error.message : "invalid-fam-json"}`;
}

function parseFam(text: string): unknown {
  const value: unknown = JSON.parse(text);
  const validation = validateFamDecomposition(value);
  if (!validation.valid) throw new TypeError(`invalid-fam-json:${validation.issues.map((issue) => `${issue.path}:${issue.code}`).join(",")}`);
  return value;
}
