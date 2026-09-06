import { GoogleGenAI } from "@google/genai";
import { resolveCredential, type CredentialSource } from "@fquery/config";
import type { CapabilityInvocation, CapabilityResult, PluginResolver } from "@fquery/core";
import type { PluginManifest } from "@fquery/plugin-sdk";

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
export interface GeminiPluginOptions { readonly model: string; readonly credentialName: string; readonly credentialSources: readonly CredentialSource[]; readonly generate?: GeminiGenerator }

export class GeminiFamPlugin implements PluginResolver {
  readonly #options: GeminiPluginOptions;
  constructor(options: GeminiPluginOptions) { this.#options = Object.freeze({ ...options, credentialSources: Object.freeze([...options.credentialSources]) }); }
  async invoke(request: CapabilityInvocation): Promise<CapabilityResult | undefined> {
    if (!CAPABILITIES.includes(request.capability as GeminiFamCapability)) return undefined;
    const resolved = await resolveCredential({ name: this.#options.credentialName, keyVariable: "GEMINI_API_KEY" }, this.#options.credentialSources);
    if (!resolved?.credential.key) return { pluginId: "plugin://fquery/gemini", transportStatus: "failed", reason: `credential-not-found:${this.#options.credentialName}` };
    try {
      const response = await (this.#options.generate ?? googleGenerate)({ apiKey: resolved.credential.key, model: this.#options.model, prompt: buildPrompt(request), responseSchema: CANDIDATE_FAM_SCHEMA });
      const candidate = parseCandidate(response.text);
      return { pluginId: geminiPluginManifest.pluginId, transportStatus: "succeeded", value: candidate, evidenceRefs: [], execution: { provider: "google", model: this.#options.model, pluginVersion: geminiPluginManifest.pluginVersion, credentialName: resolved.credential.name, ...(response.requestId ? { requestId: response.requestId } : {}) } };
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

function buildPrompt(request: CapabilityInvocation): string {
  return JSON.stringify({ proton_profile: "proton://fquery/core", capability: request.capability, source: request.input, instruction: "Return candidate FAM only. Preserve source references, contradictions, and UNKNOWN. Do not claim validation or adoption." });
}

function parseCandidate(text: string): unknown {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value) || value.schema_version !== "fquery.candidate-fam/0.1.0-draft" || !Array.isArray(value.blocks) || !Array.isArray(value.unresolved)) throw new TypeError("invalid-candidate-fam");
  return value;
}

const CANDIDATE_FAM_SCHEMA = Object.freeze({ type: "object", required: ["schema_version", "transformation", "blocks", "unresolved"], properties: { schema_version: { type: "string", enum: ["fquery.candidate-fam/0.1.0-draft"] }, transformation: { type: "string", enum: CAPABILITIES }, blocks: { type: "array", items: { type: "object", required: ["block_id", "content", "source_refs"], properties: { block_id: { type: "string" }, content: {}, source_refs: { type: "array", items: { type: "string" } } } } }, unresolved: { type: "array", items: { type: "string" } } } });
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
