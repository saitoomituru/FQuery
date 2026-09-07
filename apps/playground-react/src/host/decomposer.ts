import { createContext, useContext } from "react";
import { corePortId, statusTone, type PresentationSession, type StatusBadgeViewModel } from "@fquery/ui-core";
import { isFamJsonRecord } from "@fquery/fam-core";
import type { CoreNodeIds } from "./core-graph.js";

export interface PlaygroundRoute {
  readonly provider: "fixture" | "gemini" | "ollama";
  readonly label: string;
  readonly available: boolean;
  readonly models: readonly string[];
  readonly credentialName?: string;
  readonly reason?: string;
}

export const FIXTURE_ROUTE: PlaygroundRoute = Object.freeze({ provider: "fixture", label: "Fixture", available: true, models: ["mock-fam-transformer"] });

/**
 * Host（Playground）がΨ.NL rendererへ渡すdecomposer binding。
 * GUI Core（ui-core / ui-react）はこの型を知らない。
 */
export interface DecomposerContextValue {
  readonly routes: readonly PlaygroundRoute[];
  readonly provider: PlaygroundRoute["provider"];
  readonly model: string;
  readonly source: string;
  readonly running: boolean;
  readonly setProvider: (provider: PlaygroundRoute["provider"]) => void;
  readonly setModel: (model: string) => void;
  readonly setSource: (source: string) => void;
  readonly execute: () => Promise<void>;
}

export const DecomposerContext = createContext<DecomposerContextValue | undefined>(undefined);
export function useDecomposer(): DecomposerContextValue | undefined {
  return useContext(DecomposerContext);
}

export interface DecomposeOutcome {
  readonly response: unknown;
  readonly error?: string;
}

/** gateway越しに分解を要求する。GUIはengineを実行しない。 */
export async function requestDecompose(body: { provider: string; model: string; source: string }): Promise<DecomposeOutcome> {
  try {
    const fetched = await fetch("/api/decompose", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const payload: unknown = await fetched.json();
    if (!fetched.ok) return { response: undefined, error: isRecord(payload) && typeof payload.error === "string" ? payload.error : `decompose-http-${fetched.status}` };
    return { response: payload };
  } catch (error) {
    return { response: undefined, error: error instanceof Error ? error.message : "decompose-failed" };
  }
}

export function resultRecord(response: unknown): Record<string, unknown> | undefined {
  if (!isRecord(response) || !isRecord(response.result)) return undefined;
  return response.result;
}

/** engineが返したQueryResultをΨ.NL nodeへ投影する。GUIはstatusを再計算しない。 */
export function projectPsiNode(session: PresentationSession, ids: CoreNodeIds, input: { response: unknown; running: boolean; source: string; provider: string; model: string }): void {
  const node = session.state.nodes.find((entry) => entry.nodeId === ids.psi);
  if (!node) return;
  const record = resultRecord(input.response);
  const badges: StatusBadgeViewModel[] = (["resolution", "connection", "transport", "plugin", "semantic", "lambda", "control"] as const).map((axis) => {
    const raw = record?.[`${axis}_status`];
    const value = input.running && axis === "plugin" ? "running" : typeof raw === "string" ? raw : axis === "semantic" || axis === "lambda" ? "unknown" : "not-requested";
    return { axis, value, tone: statusTone(value) };
  });
  session.applyEngineEvent({ type: "fam.node.changed", node: { ...node, badges, value: { source_text: input.source, provider: input.provider, model: input.model }, canExecute: false } });
}

/** 分解結果FAMを∇φ.FAMVIM nodeのvalueへ投影する。正本はこのnodeのvalue。 */
export function projectFamvimNode(session: PresentationSession, ids: CoreNodeIds, response: unknown): void {
  const node = session.state.nodes.find((entry) => entry.nodeId === ids.famvim);
  if (!node) return;
  const value = resultRecord(response)?.value;
  const fam = isFamJsonRecord(value) ? value : undefined;
  const semantic = fam ? "unknown" : "not-evaluated";
  session.applyEngineEvent({ type: "fam.node.changed", node: { ...node, badges: [{ axis: "semantic", value: semantic, tone: statusTone(semantic) }], value: fam ?? null } });
}

/** λ.NLへmanifestationを投影する。fixture projectionであり、λ satisfactionは`unknown`のまま。 */
export function projectLambdaNode(session: PresentationSession, ids: CoreNodeIds): void {
  const state = session.state;
  const node = state.nodes.find((entry) => entry.nodeId === ids.lambda);
  const famvim = state.nodes.find((entry) => entry.nodeId === ids.famvim);
  if (!node) return;
  const connected = state.connections.some((connection) => connection.toPortId === corePortId(node.nodeId, "fam"));
  const value = famvim?.value;
  const lambda = isRecord(value) && isRecord(value.λ) ? value.λ : undefined;
  const units = lambda && Array.isArray(lambda.output_units) ? lambda.output_units : [];
  const manifestations = units.map((unit) => isRecord(unit) && isRecord(unit.λ) && typeof unit.λ.manifestation === "string" ? unit.λ.manifestation : "").filter(Boolean);
  const projected = connected && manifestations.length > 0;
  session.applyEngineEvent({
    type: "fam.node.changed",
    node: { ...node, badges: [{ axis: "lambda", value: "unknown", tone: statusTone("unknown") }], value: projected ? { projection_kind: "fixture-projection", manifestations } : null },
  });
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
