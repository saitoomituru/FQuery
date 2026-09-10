import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveCredential, standaloneCredentialSources } from "@fquery/config";
import { evaluateQ, Q, toWireQueryResult, type CapabilityProfileBinding, type CapabilityProfileReceipt, type CoreEvent, type PluginResolver } from "@fquery/core";
import { createLiteralDecompositionFam, isFamDecompositionRecord, projectDecompositionUnits, projectSemanticTopology, readAccessMapProfile, readFamJson, type SemanticTopologyProjection } from "@fquery/fam-core";
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
export interface GatewayOptions {
  readonly repoRoot: string;
  readonly ollamaBaseUrl?: string;
  /** testで特定refFAMを明示注入する場合だけ指定する。 */
  readonly accessMapPath?: string;
  /** gatewayからprovider/Coreまでを同じ経路で検証するための明示的なadapter seam。production既定では使用しない。 */
  readonly resolverFactory?: (request: DecomposeRequest) => PluginResolver;
}

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
  // active refFAMはprovider候補完成後のsidecarではなく、呼出し前にrevision固定する。
  const accessMapDocument = readFamJson(await readFile(join(options.repoRoot, options.accessMapPath ?? "fixtures/test-cases/basic-commons-access-mapper/generic-access-map.fam.json"), "utf8"));
  const accessMap = readAccessMapProfile(accessMapDocument.value);
  const profileBinding: CapabilityProfileBinding = Object.freeze({
    profileRef: accessMap.famId,
    revisionRef: accessMap.revisionId,
    mediaType: "application/fam+json",
    roles: Object.freeze(["generation-constraint", "validation-ruler", "presentation-ruler"] as const),
    value: accessMapDocument.value,
  });
  const resolver = options.resolverFactory?.(request) ?? createResolver(request, options);
  const result = await evaluateQ(Q(
    { kind: "literal", value: request.source },
    { queryId: `q://playground/${randomUUID()}`, operations: [{ kind: "invoke", capability: "fam.decompose" }], policy: { sideEffect: request.provider === "fixture" ? "none" : "network", limits: { maxDepth: 32, maxNodes: 10_000, timeoutMs: 45_000 } } },
  ), { pluginResolver: resolver, profileBindings: Object.freeze([profileBinding]), outputConnected: true, emit: (event) => events.push(event) });
  let validation: AccessMapValidation | undefined;
  let postValidationError: string | undefined;
  try {
    validation = validateWithAccessMap(result.value, profileBinding);
  } catch (error) {
    postValidationError = error instanceof Error ? error.message : "access-map-post-validation-failed";
  }
  if (validation) events.push(Object.freeze({ eventType: "semantic-check", queryRef: result.queryRef, status: "profile-accepted", detail: { profileReceipts: Object.freeze([validation.receipt]), semanticTopologyStatus: validation.topology.status } }));
  if (postValidationError) events.push(Object.freeze({ eventType: "semantic-check", queryRef: result.queryRef, status: "profile-rejected", detail: { profileRef: profileBinding.profileRef, revisionRef: profileBinding.revisionRef, reason: postValidationError } }));
  const generationReceipt = findProfileReceipt(events, profileBinding, "generation-constraint");
  // profile観測の不成立はcandidate FAMを棄却する理由ではない。Observer評価をsidecarに残す。
  const presentedResult = result;
  const topologyProjection = validation?.topology;
  return Object.freeze({
    result: toWireQueryResult(presentedResult),
    events: Object.freeze(events),
    access_map: accessMapDocument.value,
    ref_fam_receipt: Object.freeze({
      profile_ref: profileBinding.profileRef,
      revision_ref: profileBinding.revisionRef,
      resolved_before_provider: true,
      generation_constraint: generationReceipt ?? null,
      post_validation: validation?.receipt ?? null,
      post_validation_error: postValidationError ? Object.freeze({ code: "FQUERY-REF-FAM-NONCONFORMANT", reason: postValidationError }) : null,
      presentation_projection: Object.freeze({
        status: "provided-to-host",
        profile_ref: profileBinding.profileRef,
        revision_ref: profileBinding.revisionRef,
        semantic_topology_status: topologyProjection?.status ?? "not-evaluable",
        selected_branch_ref: topologyProjection?.selectedBranch?.branchRef ?? null,
        branch_refs: Object.freeze(topologyProjection?.branches.map((branch) => branch.branchRef) ?? []),
        selection_scope_ref: topologyProjection?.selectionScopeRef ?? null,
      }),
    }),
  });
}

interface AccessMapValidation {
  readonly receipt: CapabilityProfileReceipt;
  readonly topology: SemanticTopologyProjection;
}

function validateWithAccessMap(value: unknown, binding: CapabilityProfileBinding): AccessMapValidation | undefined {
  if (!isFamDecompositionRecord(value)) return undefined;
  const accessMap = readAccessMapProfile(binding.value as Parameters<typeof readAccessMapProfile>[0]);
  const units = projectDecompositionUnits(value, accessMap);
  if (units.some((unit) => unit.classification.accessMapFamRef !== binding.profileRef || unit.classification.accessMapRevisionRef !== binding.revisionRef)) throw new TypeError("access-map-revision-drift");
  const topology = projectSemanticTopology(value, accessMap);
  return Object.freeze({
    receipt: Object.freeze({
      profileRef: binding.profileRef,
      revisionRef: binding.revisionRef,
      appliedStages: Object.freeze(["post-validation"] as const),
      validationScope: "fam-shape-classification-and-declared-topology-binding",
      oaeConstraintEvaluations: Object.freeze([]),
    }),
    topology,
  });
}

function findProfileReceipt(events: readonly CoreEvent[], binding: CapabilityProfileBinding, stage: CapabilityProfileReceipt["appliedStages"][number]): CapabilityProfileReceipt | undefined {
  for (const event of events) {
    const receipts = event.detail?.profileReceipts;
    if (!Array.isArray(receipts)) continue;
    const found = receipts.find((candidate): candidate is CapabilityProfileReceipt => {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
      const receipt = candidate as unknown as CapabilityProfileReceipt;
      return receipt.profileRef === binding.profileRef && receipt.revisionRef === binding.revisionRef && Array.isArray(receipt.appliedStages) && receipt.appliedStages.includes(stage);
    });
    if (found) return found;
  }
  return undefined;
}

function createResolver(request: DecomposeRequest, options: GatewayOptions): PluginResolver {
  if (request.provider === "gemini") return new GeminiFamPlugin({ model: request.model, credentialName: "gemini-local", credentialSources: standaloneCredentialSources(options.repoRoot) });
  if (request.provider === "ollama") return new OllamaFamPlugin({ model: request.model, ...(options.ollamaBaseUrl ? { baseUrl: options.ollamaBaseUrl } : {}) });
  return { async invoke(invocation) {
    if (invocation.capability !== "fam.decompose") return undefined;
    return {
      pluginId: "plugin://fquery/fixture",
      transportStatus: "succeeded",
      value: createLiteralDecompositionFam(String(invocation.input), invocation.queryRef),
      evidenceRefs: ["fixture://playground/fam-decompose"],
      adapterProvenance: {
        schemaVersion: "fam.adapter-provenance/0.1.0-draft",
        producerRef: "plugin://fquery/fixture",
        producerRevision: "0.1.0-draft.0",
        adapterChain: [{ adapterRef: "plugin://fquery/fixture", adapterRevision: "0.1.0-draft.0", providerRef: "provider://fquery/test-fixture", modelRef: `model://fquery/${FIXTURE_MODEL}`, runtimeRef: "runtime://fquery/playground-node" }],
        supportClaim: { schemaVersion: "fam.adapter-support/0.1.0-draft", level: 1, capabilityRefs: ["fam.decompose"], observationSurfaces: ["fixture-request", "fixture-response"], limitations: ["test-fixture-only", "no-provider-introspection"] },
        oaeRefs: [],
      },
      execution: { provider: "fixture", model: FIXTURE_MODEL, pluginVersion: "0.1.0-draft.0" },
    };
  } };
}

function assertDecomposeRequest(value: DecomposeRequest): void {
  if (!(["fixture", "gemini", "ollama"] as const).includes(value.provider)) throw new TypeError("unsupported-provider");
  if (typeof value.model !== "string" || value.model.length === 0 || value.model.length > 200) throw new TypeError("invalid-model");
  if (typeof value.source !== "string" || value.source.trim().length === 0 || value.source.length > 100_000) throw new TypeError("invalid-source");
}
