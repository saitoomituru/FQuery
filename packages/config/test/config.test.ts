import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { callbackSource, credentialDisplay, dotenvSource, environmentSource, explicitSource, resolveCredential, standaloneCredentialSources, yamlDotfileSource } from "../src/index.js";

describe("credential resolver", () => {
  it("呼出し側が渡したsource順を保持する", async () => {
    const result = await resolveCredential({ name: "gemini", keyVariable: "GEMINI_API_KEY" }, [explicitSource([{ name: "gemini", key: "explicit-key" }]), environmentSource({ GEMINI_API_KEY: "env-key" })]);
    expect(result?.credential.key).toBe("explicit-key");
    expect(result?.sourceId).toBe("explicit");
  });
  it("dotenvをprocess.envへ展開せず解決する", async () => {
    const root = await mkdtemp(join(tmpdir(), "fquery-config-")); const path = join(root, ".env.local");
    await writeFile(path, "GEMINI_API_KEY=dotenv-key\n", "utf8");
    expect((await resolveCredential({ name: "gemini-local", keyVariable: "GEMINI_API_KEY" }, [dotenvSource(path)]))?.credential).toEqual({ name: "gemini-local", key: "dotenv-key" });
  });
  it("YAML dotfileのname/key/secretだけを受け取る", async () => {
    const root = await mkdtemp(join(tmpdir(), "fquery-config-")); const path = join(root, "credentials.yaml");
    await writeFile(path, "credentials:\n  - name: provider-a\n    key: key-value\n    secret: secret-value\n", "utf8");
    const result = await resolveCredential({ name: "provider-a" }, [yamlDotfileSource(path)]);
    expect(result?.credential).toEqual({ name: "provider-a", key: "key-value", secret: "secret-value" });
    expect(credentialDisplay(result!.credential)).toEqual({ name: "provider-a" });
  });
  it("上位IAM callbackを同じsourceとして受け取る", async () => {
    expect((await resolveCredential({ name: "upper-iam" }, [callbackSource("host-iam", () => ({ name: "upper-iam", secret: "opaque" }))]))?.sourceId).toBe("host-iam");
  });
  it("単体runnerの既定sourceをenv優先で構成する", () => {
    expect(standaloneCredentialSources("/tmp/fquery", {}).map((source) => source.sourceId)).toEqual(["process-env", "dotenv-local", "dotenv"]);
  });
});
