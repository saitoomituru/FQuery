import type { FamModuleResolver } from "./module-graph.js";
import type { FamTopologyModuleInput } from "./topology.js";

/**
 * FQuery Coreが所有する保存契約(interface)。実装はfile-backed参照実装
 * (IBD `experiments/season0/storage_adapter.py`)や本番storage adapterが提供する。
 * Coreはinterfaceとrevision解決結果の形だけを所有し、backend実装を所有しない。
 *
 * revision policyはpinnedを既定候補とし、latestを無条件採用しない。
 * 未取得・revision不一致はUNKNOWN + Last Orderで返し、推測で補完しない。
 */
export interface FamDocumentStoreRevisionPolicy {
  readonly mode: "pinned" | "latest";
  /** mode: "pinned"のとき必須。 */
  readonly revisionRef?: string;
}

export interface FamDocumentStoreLastOrder {
  readonly schemaVersion: "ibd.last-order/0.1.0-draft";
  readonly lastOrderId: string;
  readonly famlogRef: string;
  readonly branchRef: string;
  readonly status: "suspended" | "resumable" | "resolved" | "cancelled";
  readonly stoppedAt: string;
  readonly reason: { readonly code: string; readonly detail: string | null };
  readonly requestedNext: Readonly<Record<string, unknown>>;
  readonly resumeWhen: readonly string[];
  readonly purposeRef: string;
  readonly issuedBy: string;
}

export type FamDocumentStoreResolution =
  | { readonly status: "resolved"; readonly moduleRef: string; readonly revisionRef: string; readonly document: FamTopologyModuleInput }
  | { readonly status: "unknown"; readonly moduleRef: string; readonly revisionRef?: string; readonly lastOrder: FamDocumentStoreLastOrder };

/**
 * put/get/resolve/listRevisions/hasを提供するFAM Document Store契約。
 * 実装はin-memory、file-backed、IBD adapter等いずれでもよく、Coreはbackendを固定しない。
 */
export interface FamDocumentStore {
  put(document: FamTopologyModuleInput): FamTopologyModuleInput | Promise<FamTopologyModuleInput>;
  has(moduleRef: string, revisionRef: string): boolean | Promise<boolean>;
  listRevisions(moduleRef: string): readonly string[] | Promise<readonly string[]>;
  get(moduleRef: string, revisionRef: string): FamTopologyModuleInput | undefined | Promise<FamTopologyModuleInput | undefined>;
  resolve(
    moduleRef: string,
    revisionPolicy: FamDocumentStoreRevisionPolicy,
  ): FamDocumentStoreResolution | Promise<FamDocumentStoreResolution>;
}

function buildUnknownLastOrder(moduleRef: string, reasonCode: string, revisionRef?: string): FamDocumentStoreLastOrder {
  const detail = revisionRef ? `moduleRef=${moduleRef} revisionRef=${revisionRef}` : `moduleRef=${moduleRef}`;
  return Object.freeze({
    schemaVersion: "ibd.last-order/0.1.0-draft",
    lastOrderId: `last-order:${moduleRef}:${reasonCode}`,
    famlogRef: `famlog:${moduleRef}`,
    branchRef: "main",
    status: "resumable",
    stoppedAt: new Date().toISOString(),
    reason: { code: reasonCode, detail },
    requestedNext: Object.freeze({ action: "put-missing-revision", moduleRef, revisionRef: revisionRef ?? null }),
    resumeWhen: Object.freeze(["missing-revision-stored"]),
    purposeRef: "fquery.core.fam-document-store.resolve",
    issuedBy: "fquery-core-document-store",
  });
}

/**
 * Core契約テスト用のin-memory参照実装。再起動rehydrateやfile永続化は保証しない
 * (それはIBD storage adapterの責務)。put/resolve/listRevisions/hasの契約形だけを検証する。
 */
export class InMemoryFamDocumentStore implements FamDocumentStore {
  private readonly documentsByModule = new Map<string, Map<string, FamTopologyModuleInput>>();
  private readonly revisionOrderByModule = new Map<string, string[]>();

  put(document: FamTopologyModuleInput): FamTopologyModuleInput {
    const revisions = this.documentsByModule.get(document.moduleRef) ?? new Map<string, FamTopologyModuleInput>();
    revisions.set(document.revisionRef, document);
    this.documentsByModule.set(document.moduleRef, revisions);

    const order = this.revisionOrderByModule.get(document.moduleRef) ?? [];
    if (!order.includes(document.revisionRef)) order.push(document.revisionRef);
    this.revisionOrderByModule.set(document.moduleRef, order);
    return document;
  }

  has(moduleRef: string, revisionRef: string): boolean {
    return this.documentsByModule.get(moduleRef)?.has(revisionRef) ?? false;
  }

  listRevisions(moduleRef: string): readonly string[] {
    return Object.freeze([...(this.revisionOrderByModule.get(moduleRef) ?? [])]);
  }

  get(moduleRef: string, revisionRef: string): FamTopologyModuleInput | undefined {
    return this.documentsByModule.get(moduleRef)?.get(revisionRef);
  }

  resolve(moduleRef: string, revisionPolicy: FamDocumentStoreRevisionPolicy): FamDocumentStoreResolution {
    if (revisionPolicy.mode !== "pinned" && revisionPolicy.mode !== "latest") {
      throw new TypeError("revisionPolicy.modeはpinnedまたはlatestが必要です");
    }
    const revisions = this.listRevisions(moduleRef);
    if (revisions.length === 0) {
      return Object.freeze({ status: "unknown", moduleRef, lastOrder: buildUnknownLastOrder(moduleRef, "FAM-REF-NOT-FOUND") });
    }

    let revisionRef: string;
    if (revisionPolicy.mode === "pinned") {
      if (!revisionPolicy.revisionRef) throw new TypeError("mode: pinnedにはrevisionRefが必要です");
      if (!revisions.includes(revisionPolicy.revisionRef)) {
        return Object.freeze({
          status: "unknown",
          moduleRef,
          revisionRef: revisionPolicy.revisionRef,
          lastOrder: buildUnknownLastOrder(moduleRef, "REVISION-NOT-FOUND", revisionPolicy.revisionRef),
        });
      }
      revisionRef = revisionPolicy.revisionRef;
    } else {
      revisionRef = revisions[revisions.length - 1]!;
    }

    const document = this.get(moduleRef, revisionRef);
    if (!document) return Object.freeze({ status: "unknown", moduleRef, revisionRef, lastOrder: buildUnknownLastOrder(moduleRef, "REVISION-NOT-FOUND", revisionRef) });
    return Object.freeze({ status: "resolved", moduleRef, revisionRef, document });
  }
}

export interface CreateFamModuleResolverOptions {
  /**
   * selector参照がrevision_refを省略した場合の扱い。既定はlatestだが、
   * これはStoreの既定ではなく本adapterの明示可変point。呼び出し側が
   * pinned運用を強制する場合はここを上書きする。
   */
  readonly unpinnedRevisionPolicy?: (targetFamRef: string) => FamDocumentStoreRevisionPolicy;
}

/**
 * FamDocumentStoreを既存のresolveFamModuleGraph()が要求するFamModuleResolver型へ変換する。
 * module-graphの循環検出・inline非展開ロジックは再実装せず、Storeをその入口へ接続するだけ。
 */
export function createFamModuleResolver(store: FamDocumentStore, options: CreateFamModuleResolverOptions = {}): FamModuleResolver {
  const unpinnedRevisionPolicy = options.unpinnedRevisionPolicy ?? ((): FamDocumentStoreRevisionPolicy => ({ mode: "latest" }));
  return async (reference) => {
    const revisionPolicy: FamDocumentStoreRevisionPolicy = reference.targetRevisionRef
      ? { mode: "pinned", revisionRef: reference.targetRevisionRef }
      : unpinnedRevisionPolicy(reference.targetFamRef);
    const resolution = await store.resolve(reference.targetFamRef, revisionPolicy);
    return resolution.status === "resolved" ? resolution.document : undefined;
  };
}
