import type { RecursiveFoldProjection } from "./core-graph.js";

export interface RecursiveFoldRun {
  readonly parentFoldRef: string;
  readonly fingerprint: string;
  readonly generation: number;
  readonly status: "running" | "complete" | "failed" | "cancelled";
  readonly controller: AbortController;
  readonly projection?: RecursiveFoldProjection;
}

export interface RecursiveFoldStart {
  readonly accepted: boolean;
  readonly reason?: "already-running" | "cached-complete";
  readonly run: RecursiveFoldRun;
  readonly previousProjection?: RecursiveFoldProjection;
}

/** 親Fold boundary単位でrecursive dispatchを直列化し、旧generation応答を破棄する。 */
export class RecursiveFoldController {
  readonly #runs = new Map<string, RecursiveFoldRun>();

  start(parentFoldRef: string, fingerprint: string): RecursiveFoldStart {
    const previous = this.#runs.get(parentFoldRef);
    if (previous?.status === "running") return Object.freeze({ accepted: false, reason: "already-running", run: previous });
    if (previous?.status === "complete" && previous.fingerprint === fingerprint) return Object.freeze({ accepted: false, reason: "cached-complete", run: previous });
    const run: RecursiveFoldRun = Object.freeze({ parentFoldRef, fingerprint, generation: (previous?.generation ?? 0) + 1, status: "running", controller: new AbortController() });
    this.#runs.set(parentFoldRef, run);
    return Object.freeze({ accepted: true, run, ...(previous?.projection ? { previousProjection: previous.projection } : {}) });
  }

  complete(parentFoldRef: string, generation: number, projection: RecursiveFoldProjection): boolean {
    const current = this.#runs.get(parentFoldRef);
    if (!current || current.generation !== generation || current.status !== "running") return false;
    this.#runs.set(parentFoldRef, Object.freeze({ ...current, status: "complete", projection }));
    return true;
  }

  fail(parentFoldRef: string, generation: number): boolean {
    return this.#finish(parentFoldRef, generation, "failed");
  }

  cancel(parentFoldRef: string): RecursiveFoldRun | undefined {
    const current = this.#runs.get(parentFoldRef);
    if (!current || current.status !== "running") return undefined;
    current.controller.abort();
    const cancelled = Object.freeze({ ...current, status: "cancelled" as const });
    this.#runs.set(parentFoldRef, cancelled);
    return cancelled;
  }

  isCurrent(parentFoldRef: string, generation: number): boolean {
    const current = this.#runs.get(parentFoldRef);
    return current?.generation === generation && current.status === "running";
  }

  get(parentFoldRef: string): RecursiveFoldRun | undefined { return this.#runs.get(parentFoldRef); }

  #finish(parentFoldRef: string, generation: number, status: "failed" | "cancelled"): boolean {
    const current = this.#runs.get(parentFoldRef);
    if (!current || current.generation !== generation || current.status !== "running") return false;
    this.#runs.set(parentFoldRef, Object.freeze({ ...current, status }));
    return true;
  }
}

export function recursiveFoldFingerprint(input: { readonly parentFoldRef: string; readonly parentRevisionRef?: string; readonly sourceText: string; readonly provider: string; readonly model: string }): string {
  return JSON.stringify([input.parentFoldRef, input.parentRevisionRef ?? "unknown", input.sourceText, input.provider, input.model]);
}
