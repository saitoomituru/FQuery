import { describe, expect, it } from "vitest";
import type { PluginManifest } from "../src/index.js";
import { createCliHarnessHandler } from "../src/index.js";

const manifest: PluginManifest = {
  schemaVersion: "fquery.plugin/0.1.0-draft",
  pluginId: "plugin://test/codex-cli",
  pluginVersion: "0.1.0",
  capabilities: ["fam.decompose"],
  accepts: ["text/plain"],
  returns: ["application/fam+json"],
  authority: { required: false, scopes: [] },
  sideEffect: "none",
  unknownPolicy: "retain",
  lastOrderPolicy: "return-envelope",
  implementation: { language: "typescript", runtime: "host-injected-cli" },
  famSupport: {
    schemaVersion: "fam.adapter-support/0.1.0-draft",
    level: 1,
    capabilityRefs: ["fam.decompose"],
    observationSurfaces: ["stdin", "stdout", "exit-code", "redacted-stderr-status"],
    limitations: ["internal-reasoning-not-observed", "model-identity-not-proven"],
  },
};

const request = {
  queryRef: "q://test/cli",
  capability: "fam.decompose",
  input: "入力",
  sideEffect: "none" as const,
};

describe("CLI harness adapter", () => {
  it("Host注入executorのstdoutをLv1 provenance付きcandidateへ変換する", async () => {
    const handler = createCliHarnessHandler(manifest, {
      commandRef: "cli://openai/codex",
      fixedArgs: ["exec", "--json"],
      harnessRef: "harness://fquery/cli/noninteractive",
      providerRef: "provider://openai",
      modelRef: "model://openai/codex/selected-by-cli",
      timeoutMs: 30_000,
      encodeRequest: ({ input }) => JSON.stringify({ input }),
      decodeResponse: (stdout) => ({ value: JSON.parse(stdout), oaeRefs: ["oae://test/codex/1"] }),
    }, {
      async execute(invocation) {
        expect(invocation.commandRef).toBe("cli://openai/codex");
        expect(invocation.stdin).toBe(JSON.stringify({ input: "入力" }));
        return {
          exitCode: 0,
          stdout: JSON.stringify({ ψ: {}, "∇φ": [], λ: {}, Q: {} }),
          stderrStatus: "empty",
          termination: "exited",
          evidenceRefs: ["receipt://cli/codex/1"],
          requestId: "cli-run-1",
        };
      },
    });
    const result = await handler(request);
    expect(result.transportStatus).toBe("succeeded");
    expect(result.adapterProvenance).toMatchObject({
      supportClaim: { level: 1 },
      adapterChain: [{ harnessRef: "harness://fquery/cli/noninteractive" }],
      oaeRefs: ["oae://test/codex/1"],
    });
    expect(result.execution?.requestId).toBe("cli-run-1");
  });

  it("非zero exitを成功扱いせずredaction済みreceiptだけを参照する", async () => {
    const handler = createCliHarnessHandler(manifest, {
      commandRef: "cli://anthropic/claude",
      fixedArgs: ["--output-format", "json"],
      harnessRef: "harness://fquery/cli/noninteractive",
      providerRef: "provider://anthropic",
      timeoutMs: 30_000,
      encodeRequest: () => "入力",
      decodeResponse: () => ({ value: null }),
    }, {
      async execute() {
        return {
          exitCode: 2,
          stdout: "",
          stderrStatus: "present-redacted",
          termination: "exited",
          evidenceRefs: ["receipt://cli/claude/failure-1"],
          failureReason: "cli-refused-or-failed",
        };
      },
    });
    const result = await handler(request);
    expect(result).toMatchObject({ transportStatus: "failed", outputStatus: "invalid", reason: "cli-refused-or-failed" });
    expect(result.evidenceRefs).toEqual(["receipt://cli/claude/failure-1"]);
    expect(result.execution).toMatchObject({ termination: "exited", stderrStatus: "present-redacted" });
  });

  it("stdout decode失敗をtransport failureへ偽装しない", async () => {
    const handler = createCliHarnessHandler(manifest, {
      commandRef: "cli://vendor/unknown",
      fixedArgs: [],
      harnessRef: "harness://fquery/cli/noninteractive",
      providerRef: "provider://unknown",
      timeoutMs: 30_000,
      encodeRequest: () => "入力",
      decodeResponse: (stdout) => ({ value: JSON.parse(stdout) }),
    }, {
      async execute() {
        return { exitCode: 0, stdout: "not-json", stderrStatus: "empty", termination: "exited", evidenceRefs: [] };
      },
    });
    const result = await handler(request);
    expect(result).toMatchObject({ transportStatus: "succeeded", outputStatus: "invalid", candidate: "not-json", reason: "cli-output-decode-failed" });
  });
});
