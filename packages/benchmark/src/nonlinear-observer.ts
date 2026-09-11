export const NONLINEAR_OBSERVER_OAE_SCHEMA_VERSION = "fquery.nonlinear-observer-oae/0.1.0-draft" as const;

export interface TopologyRelation {
  readonly fromRef: string;
  readonly toRef: string;
  readonly relation: string;
}

export interface NonlinearTopologyObservation {
  readonly contextDimensionRefs: readonly string[];
  readonly foldBoundaryRefs: readonly string[];
  readonly semanticRelations: readonly TopologyRelation[];
  readonly toolRelations: readonly TopologyRelation[];
  readonly alternativeBranchRefs: readonly string[];
  readonly unknownRefs: readonly string[];
}

/**
 * 一つのObserverが一つのcandidateをどう読んだかを表すOAE。
 * 同じsubjectについて相反するrecordが複数成立し得る。
 */
export interface NonlinearObserverOae {
  readonly schemaVersion: typeof NONLINEAR_OBSERVER_OAE_SCHEMA_VERSION;
  readonly oaeRef: string;
  readonly oaeRevisionRef: string;
  readonly subjectRef: string;
  readonly subjectRevisionRef: string;
  readonly candidateRef: string;
  readonly candidateRevisionRef: string;
  readonly observerRef: string;
  readonly observerDomainRef: string;
  readonly ruleRef: string;
  readonly ruleRevisionRef: string;
  readonly recordIntegrity: "valid" | "invalid";
  readonly ruleConformance: "satisfied" | "not-satisfied" | "not-evaluable";
  readonly observerVerdict: string;
  readonly topology: NonlinearTopologyObservation;
  readonly evidenceRefs: readonly string[];
  readonly issueCodes: readonly string[];
  readonly [extension: string]: unknown;
}

export interface SimilarityAxis {
  readonly intersection: number;
  readonly union: number;
  /** unionが空なら、両Observerがその軸を宣言していないためnull。 */
  readonly ratio: number | null;
}

export interface ObservationDifference {
  readonly onlyLeft: readonly string[];
  readonly onlyRight: readonly string[];
}

export interface NonlinearObservationComparison {
  readonly schemaVersion: "fquery.nonlinear-observer-comparison/0.1.0-draft";
  readonly subjectRef: string;
  readonly subjectRevisionRef: string;
  readonly leftOaeRef: string;
  readonly rightOaeRef: string;
  /** 単一総合点へ平滑化しないGestalt比較vector。 */
  readonly gestaltVector: Readonly<{
    contextDimensions: SimilarityAxis;
    foldBoundaries: SimilarityAxis;
    semanticRelations: SimilarityAxis;
    toolRelations: SimilarityAxis;
    alternativeBranches: SimilarityAxis;
    unknowns: SimilarityAxis;
  }>;
  readonly differences: Readonly<{
    contextDimensions: ObservationDifference;
    foldBoundaries: ObservationDifference;
    semanticRelations: ObservationDifference;
    toolRelations: ObservationDifference;
    alternativeBranches: ObservationDifference;
    unknowns: ObservationDifference;
  }>;
  readonly observerVerdicts: readonly [string, string];
  readonly issueCodes: readonly string[];
}

export interface NonlinearObserverValidation {
  readonly valid: boolean;
  readonly issues: readonly string[];
}

export function validateNonlinearObserverOae(value: unknown): NonlinearObserverValidation {
  const issues: string[] = [];
  if (!isRecord(value)) return Object.freeze({ valid: false, issues: Object.freeze(["$:record-required"]) });
  if (value.schemaVersion !== NONLINEAR_OBSERVER_OAE_SCHEMA_VERSION) issues.push("$.schemaVersion:unsupported");
  for (const field of [
    "oaeRef", "oaeRevisionRef", "subjectRef", "subjectRevisionRef", "candidateRef", "candidateRevisionRef",
    "observerRef", "observerDomainRef", "ruleRef", "ruleRevisionRef", "observerVerdict",
  ] as const) requiredString(value, field, issues);
  if (value.recordIntegrity !== "valid" && value.recordIntegrity !== "invalid") issues.push("$.recordIntegrity:invalid");
  if (!(["satisfied", "not-satisfied", "not-evaluable"] as const).includes(value.ruleConformance as never)) issues.push("$.ruleConformance:invalid");
  if (value.recordIntegrity === "invalid" && value.ruleConformance === "satisfied") issues.push("$:invalid-record-cannot-satisfy-rule");
  stringArray(value, "evidenceRefs", issues);
  stringArray(value, "issueCodes", issues);
  validateTopology(value.topology, issues);
  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) });
}

/**
 * 二つのObserver OAEを比較する。どちらが正しいか、どのruleが偉いかは裁定しない。
 */
export function compareNonlinearObserverOae(left: NonlinearObserverOae, right: NonlinearObserverOae): NonlinearObservationComparison {
  const leftValidation = validateNonlinearObserverOae(left);
  const rightValidation = validateNonlinearObserverOae(right);
  if (!leftValidation.valid || !rightValidation.valid) {
    throw new TypeError([...leftValidation.issues.map((issue) => `left:${issue}`), ...rightValidation.issues.map((issue) => `right:${issue}`)].join(","));
  }
  if (left.subjectRef !== right.subjectRef || left.subjectRevisionRef !== right.subjectRevisionRef) {
    throw new TypeError("observer-comparison-subject-revision-mismatch");
  }

  const axes = {
    contextDimensions: compareSets(left.topology.contextDimensionRefs, right.topology.contextDimensionRefs),
    foldBoundaries: compareSets(left.topology.foldBoundaryRefs, right.topology.foldBoundaryRefs),
    semanticRelations: compareSets(left.topology.semanticRelations.map(relationKey), right.topology.semanticRelations.map(relationKey)),
    toolRelations: compareSets(left.topology.toolRelations.map(relationKey), right.topology.toolRelations.map(relationKey)),
    alternativeBranches: compareSets(left.topology.alternativeBranchRefs, right.topology.alternativeBranchRefs),
    unknowns: compareSets(left.topology.unknownRefs, right.topology.unknownRefs),
  };
  const issueCodes = [
    ...(left.ruleRef === right.ruleRef && left.ruleRevisionRef === right.ruleRevisionRef ? [] : ["observer-rule-differs"]),
    ...(left.observerVerdict === right.observerVerdict ? [] : ["observer-verdict-differs"]),
    ...(Object.values(axes).some((axis) => axis.similarity.ratio !== null && axis.similarity.ratio < 1) ? ["topology-observation-differs"] : []),
  ];

  return Object.freeze({
    schemaVersion: "fquery.nonlinear-observer-comparison/0.1.0-draft",
    subjectRef: left.subjectRef,
    subjectRevisionRef: left.subjectRevisionRef,
    leftOaeRef: left.oaeRef,
    rightOaeRef: right.oaeRef,
    gestaltVector: Object.freeze({
      contextDimensions: axes.contextDimensions.similarity,
      foldBoundaries: axes.foldBoundaries.similarity,
      semanticRelations: axes.semanticRelations.similarity,
      toolRelations: axes.toolRelations.similarity,
      alternativeBranches: axes.alternativeBranches.similarity,
      unknowns: axes.unknowns.similarity,
    }),
    differences: Object.freeze({
      contextDimensions: axes.contextDimensions.difference,
      foldBoundaries: axes.foldBoundaries.difference,
      semanticRelations: axes.semanticRelations.difference,
      toolRelations: axes.toolRelations.difference,
      alternativeBranches: axes.alternativeBranches.difference,
      unknowns: axes.unknowns.difference,
    }),
    observerVerdicts: Object.freeze([left.observerVerdict, right.observerVerdict] as const),
    issueCodes: Object.freeze(issueCodes),
  });
}

function validateTopology(value: unknown, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push("$.topology:record-required");
    return;
  }
  for (const field of ["contextDimensionRefs", "foldBoundaryRefs", "alternativeBranchRefs", "unknownRefs"] as const) stringArray(value, field, issues, "$.topology");
  for (const field of ["semanticRelations", "toolRelations"] as const) {
    const relations = value[field];
    if (!Array.isArray(relations)) {
      issues.push(`$.topology.${field}:array-required`);
      continue;
    }
    relations.forEach((relation, index) => {
      if (!isRecord(relation)) {
        issues.push(`$.topology.${field}[${index}]:record-required`);
        return;
      }
      for (const key of ["fromRef", "toRef", "relation"] as const) {
        if (typeof relation[key] !== "string" || relation[key].length === 0) issues.push(`$.topology.${field}[${index}].${key}:string-required`);
      }
    });
  }
}

function compareSets(leftValues: readonly string[], rightValues: readonly string[]): { similarity: SimilarityAxis; difference: ObservationDifference } {
  const left = new Set(leftValues);
  const right = new Set(rightValues);
  const intersection = [...left].filter((value) => right.has(value)).length;
  const union = new Set([...left, ...right]).size;
  return {
    similarity: Object.freeze({ intersection, union, ratio: union === 0 ? null : intersection / union }),
    difference: Object.freeze({
      onlyLeft: Object.freeze([...left].filter((value) => !right.has(value)).sort()),
      onlyRight: Object.freeze([...right].filter((value) => !left.has(value)).sort()),
    }),
  };
}

function relationKey(relation: TopologyRelation): string {
  return `${relation.fromRef}\u0000${relation.relation}\u0000${relation.toRef}`;
}

function requiredString(value: Record<string, unknown>, field: string, issues: string[]): void {
  if (typeof value[field] !== "string" || value[field].length === 0) issues.push(`$.${field}:string-required`);
}

function stringArray(value: Record<string, unknown>, field: string, issues: string[], prefix = "$"): void {
  const path = `${prefix}.${field}`;
  if (!Array.isArray(value[field]) || value[field].some((entry) => typeof entry !== "string" || entry.length === 0)) issues.push(`${path}:string-array-required`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * 生FAM JSON候補からNonlinearTopologyObservationを機械的に抽出する。
 *
 * LLM/generatorの自由記述をHumanが手で読んでtopologyへ書き起こす代わりに、
 * 同一rule(このrelations/unknowns/alternative_branches/fold_ref命名規約)を
 * 両candidateへ同一に適用することで、評価者が候補ごとに解釈基準を変える
 * (=生成者と同じ非公開Contextを共有する)事故を避ける。
 *
 * 既知の限界: これはformat-sensitiveな最初の一手にすぎない。candidateが
 * このrelations/unknowns命名規約に従わない自由形式で応答した場合、実際の
 * 構造発見があっても過小に観測され得る。extraction ruleとcandidateの
 * format乖離そのものをissueCodesで報告し、黙って0件へ潰さない。
 */
export function extractTopologyFromFam(fam: unknown): { readonly observation: NonlinearTopologyObservation; readonly extractionIssueCodes: readonly string[] } {
  const issues: string[] = [];
  if (!isRecord(fam) || !isRecord(fam["∇φ"])) {
    return {
      observation: Object.freeze({ contextDimensionRefs: [], foldBoundaryRefs: [], semanticRelations: [], toolRelations: [], alternativeBranchRefs: [], unknownRefs: [] }),
      extractionIssueCodes: Object.freeze(["nabla-phi-not-a-record"]),
    };
  }
  const nablaPhi = fam["∇φ"];
  const lambda = isRecord(fam["λ"]) ? fam["λ"] : {};

  const contextDimensionRefs = Object.keys(nablaPhi).map((key) => `dimension://${key}`);

  const foldBoundaryRefs: string[] = [];
  walkForRefKeys(nablaPhi, ["fold_ref", "fam_ref"], (value) => foldBoundaryRefs.push(`fold://${value}`));

  const semanticRelations: TopologyRelation[] = [];
  walkForRelations(nablaPhi, semanticRelations);
  if (semanticRelations.length === 0 && Object.keys(nablaPhi).length > 1) issues.push("no-explicit-relations-found-despite-multiple-units");

  const toolRelations: TopologyRelation[] = [];
  walkForRelations(nablaPhi, toolRelations, "tool_relations");

  const alternativeBranches = lambda["alternative_branches"];
  const alternativeBranchRefs = Array.isArray(alternativeBranches) ? alternativeBranches.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.startsWith("branch://") ? entry : `branch://${entry}`) : [];

  const unknowns = lambda["unknowns"];
  const unknownRefs = Array.isArray(unknowns) ? unknowns.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.startsWith("unknown://") ? entry : `unknown://${entry}`) : [];
  if (!Array.isArray(unknowns)) issues.push("no-unknowns-array-found");

  return {
    observation: Object.freeze({
      contextDimensionRefs: Object.freeze(contextDimensionRefs),
      foldBoundaryRefs: Object.freeze(foldBoundaryRefs),
      semanticRelations: Object.freeze(semanticRelations),
      toolRelations: Object.freeze(toolRelations),
      alternativeBranchRefs: Object.freeze(alternativeBranchRefs),
      unknownRefs: Object.freeze(unknownRefs),
    }),
    extractionIssueCodes: Object.freeze(issues),
  };
}

function walkForRefKeys(value: unknown, keys: readonly string[], onFound: (value: string) => void): void {
  if (Array.isArray(value)) {
    for (const entry of value) walkForRefKeys(entry, keys, onFound);
    return;
  }
  if (!isRecord(value)) return;
  for (const key of keys) if (typeof value[key] === "string") onFound(value[key] as string);
  for (const nested of Object.values(value)) walkForRefKeys(nested, keys, onFound);
}

function walkForRelations(value: unknown, into: TopologyRelation[], relationsKey = "relations"): void {
  if (Array.isArray(value)) {
    for (const entry of value) walkForRelations(entry, into, relationsKey);
    return;
  }
  if (!isRecord(value)) return;
  const relations = value[relationsKey];
  if (Array.isArray(relations)) {
    for (const entry of relations) {
      if (isRecord(entry) && typeof entry["from"] === "string" && typeof entry["to"] === "string" && typeof entry["relation"] === "string") {
        into.push({ fromRef: entry["from"], toRef: entry["to"], relation: entry["relation"] });
      }
    }
  }
  for (const nested of Object.values(value)) walkForRelations(nested, into, relationsKey);
}
