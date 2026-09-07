import { redactSecrets } from "./index.js";

export const FOLD_LOG_SCHEMA_VERSION = "fold.log/0.1.0-alpha" as const;
export const OAE_RECORD_PROFILE_VERSION = "oae.record/0.1.0-alpha" as const;

export type FoldOperation = "decompose" | "edit" | "validate-edge" | "cancel-edge" | "select-branch" | "integrate" | "recursive-decompose" | "attach-evidence";
export type FoldProjectionStatus = "fresh" | "needs-recomposition" | "unknown";
export type FoldLogPersistenceStatus = "volatile" | "adapter-accepted" | "persisted" | "persistence-unknown";

export interface OaeRoleRefs {
  readonly observerRef: string;
  readonly recorderRef: string;
  readonly interpreterRef?: string;
  readonly initiatorRef?: string;
  readonly executorRef?: string;
  readonly transformerRef?: string;
  readonly causalContributorRefs: readonly string[];
}

export interface FoldLogRecord {
  readonly schemaVersion: typeof FOLD_LOG_SCHEMA_VERSION;
  readonly recordProfile: typeof OAE_RECORD_PROFILE_VERSION;
  readonly traceId: string;
  readonly eventId: string;
  readonly parentEventId: string | null;
  readonly sequence: number;
  readonly operation: FoldOperation;
  readonly sourceFoldRef: string;
  readonly affectedFoldRefs: readonly string[];
  readonly sourceFamRef: string;
  readonly sourceRevisionRef: string;
  readonly resultFamRef?: string;
  readonly resultRevisionRef?: string;
  readonly accessMapFamRef?: string;
  readonly accessMapRevisionRef?: string;
  readonly registryRef: string;
  readonly roles: OaeRoleRefs;
  readonly semanticStatus: string;
  readonly projectionStatus: FoldProjectionStatus;
  readonly cancelledEdgeRefs: readonly string[];
  readonly selectedBranchRefs: readonly string[];
  readonly recompositionRequired: boolean;
  readonly beforeSha256?: string;
  readonly afterSha256?: string;
  readonly detail?: Readonly<Record<string, unknown>>;
  readonly observedAt: string;
  readonly persistenceStatus: FoldLogPersistenceStatus;
  readonly sourceMutation: false;
}

export interface FoldLogAppendInput extends Omit<FoldLogRecord, "schemaVersion" | "recordProfile" | "eventId" | "sequence" | "observedAt" | "persistenceStatus" | "sourceMutation"> {}

export interface FoldLogOptions {
  readonly clock?: () => Date;
  readonly eventIdFactory?: (traceId: string, sequence: number) => string;
  readonly redactor?: (value: unknown) => unknown;
}

/** Fold操作をOAE record profileで生成するvolatile log。永続OAE管理Systemではない。 */
export class FoldLog {
  readonly #records: FoldLogRecord[] = [];
  readonly #clock: () => Date;
  readonly #eventIdFactory: (traceId: string, sequence: number) => string;
  readonly #redactor: (value: unknown) => unknown;

  constructor(options: FoldLogOptions = {}) {
    this.#clock = options.clock ?? (() => new Date());
    this.#eventIdFactory = options.eventIdFactory ?? ((traceId, sequence) => `${traceId}/event/${sequence}`);
    this.#redactor = options.redactor ?? redactSecrets;
  }

  append(input: FoldLogAppendInput): FoldLogRecord {
    validateAppendInput(input);
    const sequence = this.#records.length + 1;
    const record: FoldLogRecord = Object.freeze({
      ...input,
      roles: freezeRoles(input.roles),
      affectedFoldRefs: Object.freeze([...input.affectedFoldRefs]),
      cancelledEdgeRefs: Object.freeze([...input.cancelledEdgeRefs]),
      selectedBranchRefs: Object.freeze([...input.selectedBranchRefs]),
      ...(input.detail ? { detail: this.#redactor(input.detail) as Readonly<Record<string, unknown>> } : {}),
      schemaVersion: FOLD_LOG_SCHEMA_VERSION,
      recordProfile: OAE_RECORD_PROFILE_VERSION,
      eventId: this.#eventIdFactory(input.traceId, sequence),
      sequence,
      observedAt: this.#clock().toISOString(),
      persistenceStatus: "volatile",
      sourceMutation: false,
    });
    this.#records.push(record);
    return record;
  }

  records(): readonly FoldLogRecord[] {
    return Object.freeze([...this.#records]);
  }
}

export interface OaeRecordSinkReceipt {
  readonly eventId: string;
  readonly status: "adapter-accepted" | "rejected" | "persistence-unknown";
  readonly sinkRef: string;
  readonly receiptRef?: string;
  /** adapter受理だけではvector graph DB／RDB双方への永続化完了を意味しない。 */
  readonly persisted: boolean | "unknown";
}

export interface OaeRecordSink {
  readonly sinkRef: string;
  append(record: FoldLogRecord): Promise<OaeRecordSinkReceipt> | OaeRecordSinkReceipt;
}

export async function deliverOaeRecord(record: FoldLogRecord, sink: OaeRecordSink): Promise<OaeRecordSinkReceipt> {
  const receipt = await sink.append(record);
  if (receipt.eventId !== record.eventId) throw new Error(`oae-sink-event-mismatch:${record.eventId}:${receipt.eventId}`);
  if (receipt.sinkRef !== sink.sinkRef) throw new Error(`oae-sink-ref-mismatch:${sink.sinkRef}:${receipt.sinkRef}`);
  return Object.freeze({ ...receipt });
}

function validateAppendInput(input: FoldLogAppendInput): void {
  for (const [name, value] of Object.entries({ traceId: input.traceId, sourceFoldRef: input.sourceFoldRef, sourceFamRef: input.sourceFamRef, sourceRevisionRef: input.sourceRevisionRef, registryRef: input.registryRef })) {
    if (!value) throw new TypeError(`fold-log-${name}-required`);
  }
  if (!input.roles.observerRef || !input.roles.recorderRef) throw new TypeError("fold-log-observer-recorder-required");
  if (input.parentEventId === undefined) throw new TypeError("fold-log-parent-event-id-required");
  if (input.projectionStatus === "needs-recomposition" && !input.recompositionRequired) throw new TypeError("fold-log-recomposition-status-inconsistent");
}

function freezeRoles(roles: OaeRoleRefs): OaeRoleRefs {
  return Object.freeze({ ...roles, causalContributorRefs: Object.freeze([...roles.causalContributorRefs]) });
}
