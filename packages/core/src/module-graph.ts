import {
  normalizeFamTopology,
  type FamModuleReference,
  type FamTopologyModuleInput,
  type NormalizedFamTopology,
} from "./topology.js";

export interface FamModuleResolveContext {
  readonly sourceTopology: NormalizedFamTopology;
  readonly referencePath: readonly string[];
}

export type FamModuleResolver = (
  reference: FamModuleReference,
  context: FamModuleResolveContext,
) => FamTopologyModuleInput | undefined | Promise<FamTopologyModuleInput | undefined>;

export interface FamModuleGraphReference {
  readonly sourceModuleRef: string;
  readonly sourceRevisionRef: string;
  readonly sourceNodeRef: string;
  readonly requestedFamRef: string;
  readonly requestedRevisionRef?: string;
  readonly resolvedModuleRef?: string;
  readonly resolvedRevisionRef?: string;
  readonly status: "resolved" | "unresolved" | "revision-mismatch" | "cycle" | "module-limit-reached";
  readonly referencePath: readonly string[];
}

export interface FamModuleGraphIssue {
  readonly code: "module-unresolved" | "module-revision-mismatch" | "module-limit-reached";
  readonly requestedFamRef: string;
  readonly detail: string;
}

export interface ResolvedFamModuleGraph {
  readonly rootModuleRef: string;
  readonly rootRevisionRef: string;
  readonly modules: readonly NormalizedFamTopology[];
  readonly references: readonly FamModuleGraphReference[];
  readonly issues: readonly FamModuleGraphIssue[];
  readonly inlineExpansion: false;
}

export interface FamExtractionAssessmentInput {
  readonly topology: NormalizedFamTopology;
  readonly nodeRef: string;
  readonly semanticConsumerRefs?: readonly string[];
  readonly targetFoldRefs?: readonly string[];
  readonly independentRevisionRequired?: boolean;
  readonly sharedOrCircularIdentity?: boolean;
  readonly losslessLocalNormalization?: boolean;
  readonly explicitlyRequested?: boolean;
}

export type FamExtractionReason =
  | "multiple-semantic-consumers"
  | "cross-fold-portability"
  | "independent-revision-required"
  | "shared-or-circular-identity"
  | "lossless-local-normalization-unavailable"
  | "explicit-extraction-request";

export interface FamExtractionAssessment {
  readonly status: "retain-local" | "extraction-candidate";
  readonly sourceModuleRef: string;
  readonly sourceRevisionRef: string;
  readonly sourceFoldRef: string;
  readonly sourceNodeRef: string;
  readonly reasons: readonly FamExtractionReason[];
  /** 可搬identityの判定であり内容の価値・真偽・refFAM種別は裁定しない。 */
  readonly semanticClassification: "not-evaluated";
}

/**
 * fam_refだけを入口にmodule graphを解決する。各moduleは独立Topologyのまま保持し、
 * 循環を含んでもJSON payloadをinline recursive copyしない。
 */
export async function resolveFamModuleGraph(
  root: FamTopologyModuleInput,
  resolver: FamModuleResolver,
  options: { readonly maxModules?: number } = {},
): Promise<ResolvedFamModuleGraph> {
  const maxModules = options.maxModules ?? 256;
  if (!Number.isSafeInteger(maxModules) || maxModules < 1) throw new TypeError("maxModulesは1以上の整数でなければなりません");

  const modules: NormalizedFamTopology[] = [];
  const references: FamModuleGraphReference[] = [];
  const issues: FamModuleGraphIssue[] = [];
  const visited = new Set<string>();

  const visit = async (input: FamTopologyModuleInput, activePath: readonly string[]): Promise<void> => {
    const key = moduleKey(input.moduleRef, input.revisionRef);
    if (visited.has(key)) return;
    visited.add(key);
    const topology = normalizeFamTopology(input);
    modules.push(topology);

    for (const reference of topology.moduleReferences) {
      const nextPath = Object.freeze([...activePath, `${reference.sourceModuleRef}:${reference.sourcePointer}`, reference.targetFamRef]);
      const resolved = await resolver(reference, Object.freeze({ sourceTopology: topology, referencePath: nextPath }));
      if (!resolved) {
        references.push(freezeGraphReference(reference, "unresolved", nextPath));
        issues.push(freezeGraphIssue("module-unresolved", reference.targetFamRef, reference.sourcePointer));
        continue;
      }
      if (reference.targetRevisionRef && reference.targetRevisionRef !== resolved.revisionRef) {
        references.push(freezeGraphReference(reference, "revision-mismatch", nextPath, resolved));
        issues.push(freezeGraphIssue("module-revision-mismatch", reference.targetFamRef, `${reference.targetRevisionRef} != ${resolved.revisionRef}`));
        continue;
      }
      const resolvedKey = moduleKey(resolved.moduleRef, resolved.revisionRef);
      const cycle = activePath.includes(resolvedKey);
      if (cycle || visited.has(resolvedKey)) {
        references.push(freezeGraphReference(reference, cycle ? "cycle" : "resolved", nextPath, resolved));
        continue;
      }
      if (modules.length >= maxModules) {
        references.push(freezeGraphReference(reference, "module-limit-reached", nextPath, resolved));
        issues.push(freezeGraphIssue("module-limit-reached", reference.targetFamRef, `maxModules=${maxModules}`));
        continue;
      }
      references.push(freezeGraphReference(reference, "resolved", nextPath, resolved));
      await visit(resolved, Object.freeze([...activePath, resolvedKey]));
    }
  };

  await visit(root, Object.freeze([moduleKey(root.moduleRef, root.revisionRef)]));
  return Object.freeze({
    rootModuleRef: root.moduleRef,
    rootRevisionRef: root.revisionRef,
    modules: Object.freeze(modules),
    references: Object.freeze(references),
    issues: Object.freeze(issues),
    inlineExpansion: false,
  });
}

/** independent identityが必要な条件を機械的に列挙し、抽出候補へ送る。 */
export function assessFamExtraction(input: FamExtractionAssessmentInput): FamExtractionAssessment {
  const node = input.topology.nodes.find((candidate) => candidate.nodeRef === input.nodeRef);
  if (!node) throw new TypeError(`topology-node-not-found:${input.nodeRef}`);
  const reasons: FamExtractionReason[] = [];
  if (new Set(input.semanticConsumerRefs ?? []).size > 1) reasons.push("multiple-semantic-consumers");
  if ((input.targetFoldRefs ?? []).some((foldRef) => foldRef !== node.owningFoldRef)) reasons.push("cross-fold-portability");
  if (input.independentRevisionRequired) reasons.push("independent-revision-required");
  if (input.sharedOrCircularIdentity) reasons.push("shared-or-circular-identity");
  if (input.losslessLocalNormalization === false) reasons.push("lossless-local-normalization-unavailable");
  if (input.explicitlyRequested) reasons.push("explicit-extraction-request");
  return Object.freeze({
    status: reasons.length === 0 ? "retain-local" : "extraction-candidate",
    sourceModuleRef: node.owningModuleRef,
    sourceRevisionRef: node.owningRevisionRef,
    sourceFoldRef: node.owningFoldRef,
    sourceNodeRef: node.nodeRef,
    reasons: Object.freeze(reasons),
    semanticClassification: "not-evaluated",
  });
}

function freezeGraphReference(
  reference: FamModuleReference,
  status: FamModuleGraphReference["status"],
  referencePath: readonly string[],
  resolved?: FamTopologyModuleInput,
): FamModuleGraphReference {
  return Object.freeze({
    sourceModuleRef: reference.sourceModuleRef,
    sourceRevisionRef: reference.sourceRevisionRef,
    sourceNodeRef: reference.sourceNodeRef,
    requestedFamRef: reference.targetFamRef,
    ...(reference.targetRevisionRef ? { requestedRevisionRef: reference.targetRevisionRef } : {}),
    ...(resolved ? { resolvedModuleRef: resolved.moduleRef, resolvedRevisionRef: resolved.revisionRef } : {}),
    status,
    referencePath: Object.freeze([...referencePath]),
  });
}

function freezeGraphIssue(code: FamModuleGraphIssue["code"], requestedFamRef: string, detail: string): FamModuleGraphIssue {
  return Object.freeze({ code, requestedFamRef, detail });
}

function moduleKey(moduleRef: string, revisionRef: string): string {
  return `${moduleRef}@${revisionRef}`;
}
