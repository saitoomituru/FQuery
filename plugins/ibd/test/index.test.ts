import { existsSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { evaluateQ, Q } from "@fquery/core";
import { PluginRegistry } from "@fquery/plugin-sdk";
import { createIbdPlugin, ibdPluginManifest } from "../src/index.js";

/**
 * IBDは別repositoryのため、環境変数FQUERY_IBD_ROOTまたは既知のsibling
 * checkoutパスが実在する場合だけ実subprocess経由の統合testを実行する。
 * 無ければ移植性のためskipする(CI等でIBD checkoutが無い場合を想定)。
 */
const candidateIbdRoot = process.env.FQUERY_IBD_ROOT ?? "/Users/saitoumitsuru/IBD/IBD";
const ibdCliExists = existsSync(join(candidateIbdRoot, "experiments/season0/fquery_cli.py"));

describe.skipIf(!ibdCliExists)("@fam/ibd -> IBD fquery_cli.py 実subprocess統合", () => {
  let storageRoot: string;

  beforeEach(() => {
    storageRoot = mkdtempSync(join(tmpdir(), "fquery-ibd-plugin-test-"));
  });

  afterEach(() => {
    rmSync(storageRoot, { recursive: true, force: true });
  });

  it("ibd.put -> ibd.resolveが実IBD subprocessを経由してround-tripする", async () => {
    const { manifest, handler } = createIbdPlugin({ ibdRoot: candidateIbdRoot, storageRoot });
    const registry = new PluginRegistry();
    registry.register(manifest, handler);

    const document = {
      fam_ref: "fam:fquery-ibd-plugin-test-1",
      revision_ref: "rev-1",
      l_topology: { parent: null, children: [], siblings: [], prev: null, next: null },
      fold_refs: [],
      q_refs: { registry_refs: [], fact_scope: "test" },
      provenance: { source: "fquery-ibd-plugin-test" },
    };

    const putQuery = Q(
      { kind: "literal", value: { document } },
      { queryId: "q://test/ibd-put", operations: [{ kind: "invoke", capability: "ibd.put" }], policy: { sideEffect: "write" } },
    );
    const putResult = await evaluateQ(putQuery, { pluginResolver: registry });
    expect(putResult.pluginStatus).toBe("resolved");
    expect(putResult.transportStatus).toBe("succeeded");
    expect((putResult.value as { status: string }).status).toBe("ok");

    const resolveQuery = Q(
      { kind: "literal", value: { famRef: "fam:fquery-ibd-plugin-test-1", revisionPolicy: { mode: "latest" } } },
      { queryId: "q://test/ibd-resolve", operations: [{ kind: "invoke", capability: "ibd.resolve" }], policy: { sideEffect: "write" } },
    );
    const resolveResult = await evaluateQ(resolveQuery, { pluginResolver: registry });
    expect(resolveResult.pluginStatus).toBe("resolved");
    const resolved = resolveResult.value as { result: { status: string; document: { fam_ref: string } } };
    expect(resolved.result.status).toBe("resolved");
    expect(resolved.result.document.fam_ref).toBe("fam:fquery-ibd-plugin-test-1");
  });

  it("未知fam_refのresolveは例外ではなくstatus:unknownとして返る", async () => {
    const { manifest, handler } = createIbdPlugin({ ibdRoot: candidateIbdRoot, storageRoot });
    const registry = new PluginRegistry();
    registry.register(manifest, handler);

    const resolveQuery = Q(
      { kind: "literal", value: { famRef: "fam:does-not-exist", revisionPolicy: { mode: "latest" } } },
      { queryId: "q://test/ibd-resolve-unknown", operations: [{ kind: "invoke", capability: "ibd.resolve" }], policy: { sideEffect: "write" } },
    );
    const result = await evaluateQ(resolveQuery, { pluginResolver: registry });
    expect(result.pluginStatus).toBe("resolved");
    const resolved = result.value as { result: { status: string } };
    expect(resolved.result.status).toBe("unknown");
  });

  it("ibd.put_oae -> ibd.resolve_with_oaeが実IBD subprocessを経由してFAMとOAEをround-tripする(#44 Phase D)", async () => {
    const { manifest, handler } = createIbdPlugin({ ibdRoot: candidateIbdRoot, storageRoot });
    const registry = new PluginRegistry();
    registry.register(manifest, handler);

    // source_documentを保持したdocument(fquery_fam_adapter.pyのlossless契約)
    const document = {
      fam_ref: "fam:fquery-ibd-plugin-oae-test-1",
      revision_ref: "rev-1",
      l_topology: { parent: null, children: [], siblings: [], prev: null, next: null },
      fold_refs: [],
      q_refs: { registry_refs: [], fact_scope: "test" },
      provenance: { source: "fquery-ibd-plugin-oae-test" },
      source_document: { fam_id: "fam:fquery-ibd-plugin-oae-test-1", revision_id: "rev-1", kind: "decomposition" },
    };
    const putQuery = Q(
      { kind: "literal", value: { document } },
      { queryId: "q://test/ibd-put-oae-setup", operations: [{ kind: "invoke", capability: "ibd.put" }], policy: { sideEffect: "write" } },
    );
    await evaluateQ(putQuery, { pluginResolver: registry });

    const putOaeQuery = Q(
      {
        kind: "literal",
        value: {
          subjectRef: "fam:fquery-ibd-plugin-oae-test-1@rev-1",
          oaeRef: "oae:fquery-ibd-plugin-oae-test-1",
          envelope: { observer_ref: "observer://fquery-plugin-test", observerVerdict: "nontrivial" },
        },
      },
      { queryId: "q://test/ibd-put-oae", operations: [{ kind: "invoke", capability: "ibd.put_oae" }], policy: { sideEffect: "write" } },
    );
    const putOaeResult = await evaluateQ(putOaeQuery, { pluginResolver: registry });
    expect(putOaeResult.pluginStatus).toBe("resolved");
    expect((putOaeResult.value as { status: string }).status).toBe("ok");

    const resolveWithOaeQuery = Q(
      { kind: "literal", value: { famRef: "fam:fquery-ibd-plugin-oae-test-1", revisionPolicy: { mode: "latest" } } },
      { queryId: "q://test/ibd-resolve-with-oae", operations: [{ kind: "invoke", capability: "ibd.resolve_with_oae" }], policy: { sideEffect: "write" } },
    );
    const resolveWithOaeResult = await evaluateQ(resolveWithOaeQuery, { pluginResolver: registry });
    expect(resolveWithOaeResult.pluginStatus).toBe("resolved");
    const resolved = resolveWithOaeResult.value as {
      result: { status: string; fam: { fam_id: string }; oae_records: Array<{ envelope: { observer_ref: string } }> };
    };
    expect(resolved.result.status).toBe("resolved");
    // backend固有schema(l_topology等)がFQuery側projectionへ逆流しない
    expect(resolved.result.fam).not.toHaveProperty("l_topology");
    expect(resolved.result.fam.fam_id).toBe("fam:fquery-ibd-plugin-oae-test-1");
    expect(resolved.result.oae_records).toHaveLength(1);
    expect(resolved.result.oae_records[0].envelope.observer_ref).toBe("observer://fquery-plugin-test");
  });
});

describe("ibdPluginManifest", () => {
  it("put/resolve/put_oae/resolve_with_oaeのcapabilityを宣言し、reference-implementation-onlyの限界を自己申告する", () => {
    expect(ibdPluginManifest.capabilities).toEqual(["ibd.put", "ibd.resolve", "ibd.put_oae", "ibd.resolve_with_oae"]);
    expect(ibdPluginManifest.famSupport.limitations).toContain("reference-implementation-only(file-backed FamDocumentStore、本番backend adapter未接続)");
  });
});
