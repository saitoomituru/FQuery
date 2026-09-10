import { execPath } from "node:process";
import { describe, expect, it } from "vitest";
import { createRegisteredCliExecutor } from "../server/cli-executor.js";

const repoRoot = process.cwd();

describe("Playground Host CLI executor", () => {
  it("許可済みcommandRefをshellなしで実行しstderr本文を公開しない", async () => {
    const args = ["-e", "process.stdin.on('data', b => { process.stderr.write('secret'); process.stdout.write(String(b).toUpperCase()) })"];
    const executor = createRegisteredCliExecutor({
      commands: {
        "cli://test/uppercase": { executablePath: execPath, args, workingDirectory: repoRoot, maxTimeoutMs: 1_000 },
      },
      createRequestId: () => "cli-run-test-1",
    });

    const receipt = await executor.execute({ commandRef: "cli://test/uppercase", args, stdin: "入力abc", timeoutMs: 1_000 });

    expect(receipt).toEqual({
      exitCode: 0,
      stdout: "入力ABC",
      stderrStatus: "present-redacted",
      termination: "exited",
      evidenceRefs: [],
      requestId: "cli-run-test-1",
    });
    expect(JSON.stringify(receipt)).not.toContain("secret");
  });

  it("未登録commandRefとargs差し替えをprocess起動前に拒否する", async () => {
    const executor = createRegisteredCliExecutor({
      commands: {
        "cli://test/fixed": { executablePath: execPath, args: ["--version"], workingDirectory: repoRoot, maxTimeoutMs: 1_000 },
      },
      createRequestId: () => "cli-run-rejected",
    });

    await expect(executor.execute({ commandRef: "cli://unknown", args: [], stdin: "", timeoutMs: 100 })).resolves.toMatchObject({
      termination: "spawn-failed",
      failureReason: "cli-command-ref-not-registered",
    });
    await expect(executor.execute({ commandRef: "cli://test/fixed", args: ["-e", "evil"], stdin: "", timeoutMs: 100 })).resolves.toMatchObject({
      termination: "spawn-failed",
      failureReason: "cli-args-not-registered",
    });
  });

  it("timeoutを成功exitへ偽装しない", async () => {
    const args = ["-e", "setTimeout(() => process.stdout.write('late'), 10_000)"];
    const executor = createRegisteredCliExecutor({
      commands: {
        "cli://test/slow": { executablePath: execPath, args, workingDirectory: repoRoot, maxTimeoutMs: 1_000 },
      },
      createRequestId: () => "cli-run-timeout",
    });

    await expect(executor.execute({ commandRef: "cli://test/slow", args, stdin: "", timeoutMs: 20 })).resolves.toMatchObject({
      termination: "timeout",
      failureReason: "cli-timeout",
    });
  });
});
