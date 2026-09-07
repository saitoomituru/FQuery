export type ParentContextStatus = "resolved" | "unknown" | "bottom";
export type FoldChildStatus = "ready" | "completed" | "unverified";

export interface FoldChildPlanInput {
  readonly childRef: string;
  readonly dependsOn: readonly string[];
  readonly status: FoldChildStatus;
}

export interface BlockedFoldChild {
  readonly childRef: string;
  readonly reason: "parent-context-unresolved" | "child-status-unverified" | "dependency-not-found" | "dependency-cycle-or-blocked";
  readonly dependencyRefs: readonly string[];
}

export interface ParallelFoldPlan {
  readonly parentContextStatus: ParentContextStatus;
  readonly waves: readonly (readonly string[])[];
  readonly completedChildRefs: readonly string[];
  readonly blocked: readonly BlockedFoldChild[];
  readonly parallelExecutionAuthorized: false;
}

/**
 * 意味依存から実行可能waveを計画する。計画はprovider処理の起動権限を付与しない。
 */
export function planParallelFold(
  parentContextStatus: ParentContextStatus,
  children: readonly FoldChildPlanInput[],
): ParallelFoldPlan {
  const byRef = new Map<string, FoldChildPlanInput>();
  for (const child of children) {
    if (!child.childRef) throw new TypeError("childRefは空にできません");
    if (byRef.has(child.childRef)) throw new TypeError(`duplicate-child-ref:${child.childRef}`);
    byRef.set(child.childRef, child);
  }
  const completed = new Set(children.filter((child) => child.status === "completed").map((child) => child.childRef));
  const blocked: BlockedFoldChild[] = [];
  if (parentContextStatus !== "resolved") {
    for (const child of children.filter((item) => item.status !== "completed")) blocked.push(freezeBlocked(child.childRef, "parent-context-unresolved", []));
    return freezePlan(parentContextStatus, [], completed, blocked);
  }

  const schedulable = new Map(children.filter((child) => child.status === "ready").map((child) => [child.childRef, child]));
  for (const child of children.filter((item) => item.status === "unverified")) {
    blocked.push(freezeBlocked(child.childRef, "child-status-unverified", []));
  }
  for (const child of [...schedulable.values()]) {
    const missing = child.dependsOn.filter((dependency) => !byRef.has(dependency));
    if (missing.length > 0) {
      blocked.push(freezeBlocked(child.childRef, "dependency-not-found", missing));
      schedulable.delete(child.childRef);
    }
  }

  const waves: string[][] = [];
  const available = new Set(completed);
  while (schedulable.size > 0) {
    const wave = [...schedulable.values()]
      .filter((child) => child.dependsOn.every((dependency) => available.has(dependency)))
      .map((child) => child.childRef)
      .sort();
    if (wave.length === 0) break;
    waves.push(wave);
    for (const childRef of wave) {
      available.add(childRef);
      schedulable.delete(childRef);
    }
  }
  for (const child of schedulable.values()) {
    blocked.push(freezeBlocked(child.childRef, "dependency-cycle-or-blocked", child.dependsOn.filter((dependency) => !available.has(dependency))));
  }
  return freezePlan(parentContextStatus, waves, completed, blocked);
}

function freezeBlocked(childRef: string, reason: BlockedFoldChild["reason"], dependencyRefs: readonly string[]): BlockedFoldChild {
  return Object.freeze({ childRef, reason, dependencyRefs: Object.freeze([...dependencyRefs]) });
}

function freezePlan(
  parentContextStatus: ParentContextStatus,
  waves: readonly (readonly string[])[],
  completed: ReadonlySet<string>,
  blocked: readonly BlockedFoldChild[],
): ParallelFoldPlan {
  return Object.freeze({
    parentContextStatus,
    waves: Object.freeze(waves.map((wave) => Object.freeze([...wave]))),
    completedChildRefs: Object.freeze([...completed].sort()),
    blocked: Object.freeze([...blocked]),
    parallelExecutionAuthorized: false,
  });
}
