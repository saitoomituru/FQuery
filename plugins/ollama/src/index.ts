import type { CapabilityInvocation, CapabilityResult, PluginResolver } from "@fquery/core";
import type { PluginManifest } from "@fquery/plugin-sdk";

export type OllamaFamCapability = "fam.decompose" | "fam.integrate" | "fam.compare" | "fam.project";
const CAPABILITIES: readonly OllamaFamCapability[] = ["fam.decompose", "fam.integrate", "fam.compare", "fam.project"];

export const ollamaPluginManifest: PluginManifest = Object.freeze({
  schemaVersion: "fquery.plugin/0.1.0-draft",
  pluginId: "plugin://fquery/ollama",
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

export interface OllamaModel { readonly name: string; readonly size?: number; readonly family?: string }
export interface OllamaGenerateRequest { readonly baseUrl: string; readonly model: string; readonly prompt: string; readonly responseSchema: Readonly<Record<string, unknown>> }
export interface OllamaGenerateResponse { readonly text: string }
export type OllamaGenerator = (request: OllamaGenerateRequest) => Promise<OllamaGenerateResponse>;
export interface OllamaPluginOptions { readonly model: string; readonly baseUrl?: string; readonly generate?: OllamaGenerator }

export class OllamaFamPlugin implements PluginResolver {
  readonly #options: Required<Pick<OllamaPluginOptions, "model" | "baseUrl">> & Pick<OllamaPluginOptions, "generate">;

  constructor(options: OllamaPluginOptions) {
    this.#options = Object.freeze({ model: options.model, baseUrl: normalizeBaseUrl(options.baseUrl ?? "http://127.0.0.1:11434"), ...(options.generate ? { generate: options.generate } : {}) });
  }

  async invoke(request: CapabilityInvocation): Promise<CapabilityResult | undefined> {
    if (!CAPABILITIES.includes(request.capability as OllamaFamCapability)) return undefined;
    if (request.sideEffect !== "network") return { pluginId: ollamaPluginManifest.pluginId, pluginStatus: "rejected", transportStatus: "failed", reason: "network-side-effect-not-authorized" };
    try {
      const response = await (this.#options.generate ?? ollamaGenerate)({ baseUrl: this.#options.baseUrl, model: this.#options.model, prompt: buildPrompt(request), responseSchema: CANDIDATE_FAM_SCHEMA });
      return {
        pluginId: ollamaPluginManifest.pluginId,
        transportStatus: "succeeded",
        value: parseCandidate(response.text),
        evidenceRefs: [],
        execution: { provider: "ollama", model: this.#options.model, pluginVersion: ollamaPluginManifest.pluginVersion },
      };
    } catch (error) {
      return {
        pluginId: ollamaPluginManifest.pluginId,
        transportStatus: "failed",
        reason: error instanceof Error ? error.message : "ollama-call-failed",
        execution: { provider: "ollama", model: this.#options.model, pluginVersion: ollamaPluginManifest.pluginVersion },
      };
    }
  }
}

export async function discoverOllamaModels(baseUrl = "http://127.0.0.1:11434", fetcher: typeof fetch = fetch): Promise<readonly OllamaModel[]> {
  const response = await fetcher(`${normalizeBaseUrl(baseUrl)}/api/tags`, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`ollama-tags-http-${response.status}`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.models)) throw new TypeError("invalid-ollama-tags-response");
  return Object.freeze(payload.models.flatMap((entry): OllamaModel[] => {
    if (!isRecord(entry) || typeof entry.name !== "string") return [];
    const details = isRecord(entry.details) ? entry.details : undefined;
    return [Object.freeze({ name: entry.name, ...(typeof entry.size === "number" ? { size: entry.size } : {}), ...(details && typeof details.family === "string" ? { family: details.family } : {}) })];
  }));
}

async function ollamaGenerate(request: OllamaGenerateRequest): Promise<OllamaGenerateResponse> {
  const response = await fetch(`${request.baseUrl}/api/generate`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ model: request.model, prompt: request.prompt, stream: false, think: false, format: request.responseSchema, options: { temperature: 0, num_predict: 1024 } }),
    signal: AbortSignal.timeout(115_000),
  });
  if (!response.ok) throw new Error(`ollama-generate-http-${response.status}`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || typeof payload.response !== "string" || payload.response.length === 0) throw new TypeError("invalid-ollama-generate-response");
  return { text: payload.response };
}

function buildPrompt(request: CapabilityInvocation): string {
  return JSON.stringify({ proton_profile: "proton://fquery/core", capability: request.capability, source: request.input, instruction: "Return candidate FAM JSON only. Split the source into independent semantic blocks. Preserve contradictions and UNKNOWN. Do not claim validation or adoption." });
}

function parseCandidate(text: string): unknown {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value) || value.schema_version !== "fquery.candidate-fam/0.1.0-draft" || !Array.isArray(value.blocks) || !Array.isArray(value.unresolved)) throw new TypeError("invalid-candidate-fam");
  return value;
}

const CANDIDATE_FAM_SCHEMA = Object.freeze({
  type: "object",
  required: ["schema_version", "transformation", "blocks", "unresolved"],
  properties: {
    schema_version: { type: "string", enum: ["fquery.candidate-fam/0.1.0-draft"] },
    transformation: { type: "string", enum: CAPABILITIES },
    blocks: { type: "array", items: { type: "object", required: ["block_id", "content", "source_refs"], properties: { block_id: { type: "string" }, content: { type: "string" }, source_refs: { type: "array", items: { type: "string" } } } } },
    unresolved: { type: "array", items: { type: "string" } },
  },
});

function normalizeBaseUrl(value: string): string { return value.replace(/\/+$/, ""); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
