import { randomUUID } from "node:crypto";
import { resolveCredential, standaloneCredentialSources } from "@fquery/config";
import { evaluateQ, Q, toWireQueryResult, type CoreEvent, type PluginResolver } from "@fquery/core";
import { discoverGeminiModels, GeminiFamPlugin } from "@fquery/plugin-gemini";
import { discoverOllamaModels, OllamaFamPlugin } from "@fquery/plugin-ollama";

export interface PlaygroundRoute {
  readonly provider: "fixture" | "gemini" | "ollama";
  readonly label: string;
  readonly available: boolean;
  readonly models: readonly string[];
  readonly credentialName?: string;
  readonly reason?: string;
}

export interface DecomposeRequest { readonly provider: PlaygroundRoute["provider"]; readonly model: string; readonly source: string }
export interface GatewayOptions { readonly repoRoot: string; readonly ollamaBaseUrl?: string }

const FIXTURE_MODEL = "mock-fam-transformer";

export async function listPlaygroundRoutes(options: GatewayOptions): Promise<readonly PlaygroundRoute[]> {
  const credentialName = "gemini-local";
  const geminiCredential = await resolveCredential({ name: credentialName, keyVariable: "GEMINI_API_KEY" }, standaloneCredentialSources(options.repoRoot));
  let geminiModels: readonly string[] = [];
  let geminiReason: string | undefined;
  if (geminiCredential?.credential.key) {
    try {
      geminiModels = orderGeminiTextModels((await discoverGeminiModels(geminiCredential.credential.key)).map((model) => model.name));
    } catch (error) {
      geminiReason = error instanceof Error ? error.message : "gemini-model-discovery-failed";
    }
  }
  let ollamaModels: readonly string[] = [];
  let ollamaReason: string | undefined;
  try {
    ollamaModels = (await discoverOllamaModels(options.ollamaBaseUrl)).map((model) => model.name);
  } catch (error) {
    ollamaReason = error instanceof Error ? error.message : "ollama-unavailable";
  }
  return Object.freeze([
    Object.freeze({ provider: "fixture", label: "Fixture", available: true, models: [FIXTURE_MODEL] }),
    Object.freeze({ provider: "gemini", label: "Gemini", available: geminiModels.length > 0, models: geminiModels, credentialName, ...(!geminiCredential?.credential.key ? { reason: "credential-not-found" } : geminiReason ? { reason: geminiReason } : {}) }),
    Object.freeze({ provider: "ollama", label: "Ollama Local", available: ollamaModels.length > 0, models: ollamaModels, ...(ollamaReason ? { reason: ollamaReason } : {}) }),
  ]);
}

function orderGeminiTextModels(models: readonly string[]): readonly string[] {
  const preferred = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-flash-lite-latest", "gemini-flash-latest"];
  const textModels = models.filter((name) => !/(image|tts|transcribe|robotics|computer-use)/i.test(name));
  return Object.freeze([...textModels].sort((left, right) => {
    const leftRank = preferred.indexOf(left);
    const rightRank = preferred.indexOf(right);
    if (leftRank >= 0 || rightRank >= 0) return (leftRank < 0 ? preferred.length : leftRank) - (rightRank < 0 ? preferred.length : rightRank);
    return left.localeCompare(right);
  }));
}

export async function decomposeText(request: DecomposeRequest, options: GatewayOptions): Promise<Readonly<Record<string, unknown>>> {
  assertDecomposeRequest(request);
  const events: CoreEvent[] = [];
  const resolver = createResolver(request, options);
  const result = await evaluateQ(Q(
    { kind: "literal", value: request.source },
    { queryId: `q://playground/${randomUUID()}`, operations: [{ kind: "invoke", capability: "fam.decompose" }], policy: { sideEffect: request.provider === "fixture" ? "none" : "network", limits: { maxDepth: 32, maxNodes: 10_000, timeoutMs: 120_000 } } },
  ), { pluginResolver: resolver, outputConnected: true, emit: (event) => events.push(event) });
  return Object.freeze({ result: toWireQueryResult(result), events: Object.freeze(events) });
}

function createResolver(request: DecomposeRequest, options: GatewayOptions): PluginResolver {
  if (request.provider === "gemini") return new GeminiFamPlugin({ model: request.model, credentialName: "gemini-local", credentialSources: standaloneCredentialSources(options.repoRoot) });
  if (request.provider === "ollama") return new OllamaFamPlugin({ model: request.model, ...(options.ollamaBaseUrl ? { baseUrl: options.ollamaBaseUrl } : {}) });
  return { async invoke(invocation) {
    if (invocation.capability !== "fam.decompose") return undefined;
    return { pluginId: "plugin://fquery/fixture", transportStatus: "succeeded", value: { schema_version: "fquery.candidate-fam/0.1.0-draft", transformation: "fam.decompose", blocks: [{ block_id: "fixture-1", content: String(invocation.input), source_refs: ["input://source"] }], unresolved: [] }, evidenceRefs: ["fixture://playground/fam-decompose"], execution: { provider: "fixture", model: FIXTURE_MODEL, pluginVersion: "0.1.0-draft.0" } };
  } };
}

function assertDecomposeRequest(value: DecomposeRequest): void {
  if (!(["fixture", "gemini", "ollama"] as const).includes(value.provider)) throw new TypeError("unsupported-provider");
  if (typeof value.model !== "string" || value.model.length === 0 || value.model.length > 200) throw new TypeError("invalid-model");
  if (typeof value.source !== "string" || value.source.trim().length === 0 || value.source.length > 100_000) throw new TypeError("invalid-source");
}
