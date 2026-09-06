import type { ControlStatus, QueryResult } from "@fquery/core";

export type StatusTone = "neutral" | "active" | "success" | "notice" | "warning" | "danger" | "unknown";

export interface StatusBadgeViewModel {
  readonly axis: string;
  readonly value: string;
  readonly tone: StatusTone;
}

export interface PortViewModel {
  readonly portId: string;
  readonly label: string;
  readonly direction: "input" | "output";
  readonly connectionStatus: QueryResult["connectionStatus"];
}

export interface LastOrderViewModel {
  readonly code: string;
  readonly reason: string;
  readonly requestedNext: string;
  readonly resumeWhen: string;
}

export interface NodeViewModel {
  readonly nodeId: string;
  readonly label: string;
  readonly badges: readonly StatusBadgeViewModel[];
  readonly ports: readonly PortViewModel[];
  readonly value: unknown;
  readonly evidenceRefs: readonly string[];
  readonly lastOrder?: LastOrderViewModel;
  readonly canExecute: boolean;
  readonly canCancel: boolean;
}

export type FQueryUiEvent =
  | { readonly type: "connect"; readonly fromPortId: string; readonly toPortId: string }
  | { readonly type: "disconnect"; readonly portId: string }
  | { readonly type: "inspect"; readonly nodeId: string }
  | { readonly type: "preview"; readonly nodeId: string }
  | { readonly type: "execute-request"; readonly nodeId: string }
  | { readonly type: "cancel-request"; readonly nodeId: string };

export function createNodeViewModel(result: QueryResult, label = result.queryRef): NodeViewModel {
  const badges = [
    badge("resolution", result.resolutionStatus),
    badge("connection", result.connectionStatus),
    badge("transport", result.transportStatus),
    badge("plugin", result.pluginStatus),
    badge("semantic", result.semanticStatus),
    badge("lambda", result.lambdaStatus),
    badge("control", result.controlStatus),
  ];
  return Object.freeze({
    nodeId: result.queryRef,
    label,
    badges: Object.freeze(badges),
    ports: Object.freeze([
      { portId: `${result.queryRef}:input`, label: "input", direction: "input" as const, connectionStatus: "connected" as const },
      { portId: `${result.queryRef}:output`, label: "output", direction: "output" as const, connectionStatus: result.connectionStatus },
    ]),
    value: result.value,
    evidenceRefs: Object.freeze([...result.evidenceRefs]),
    ...(result.lastOrder ? { lastOrder: Object.freeze({ ...result.lastOrder }) } : {}),
    canExecute: canExecute(result.controlStatus),
    canCancel: result.controlStatus === "continue",
  });
}

export function statusTone(value: string): StatusTone {
  if (["satisfied", "succeeded", "resolved", "connected", "result", "valid-variation"].includes(value)) return "success";
  if (["running", "continue"].includes(value)) return "active";
  if (["unconnected", "not-started", "not-requested", "not-evaluated", "not-applicable"].includes(value)) return "notice";
  if (["unknown", "unresolved"].includes(value)) return "unknown";
  if (["semantic-unsatisfied", "unsatisfied", "last-order", "plugin-not-found"].includes(value)) return "warning";
  if (["bottom", "failed", "rejected", "cancelled"].includes(value)) return "danger";
  return "neutral";
}

function badge(axis: string, value: string): StatusBadgeViewModel {
  return Object.freeze({ axis, value, tone: statusTone(value) });
}

function canExecute(status: ControlStatus): boolean {
  return status === "result" || status === "last-order" || status === "bottom" || status === "cancelled";
}
