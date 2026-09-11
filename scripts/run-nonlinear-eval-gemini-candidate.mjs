import { readFile, writeFile } from "node:fs/promises";
import { standaloneCredentialSources } from "@fquery/config";
import { GeminiNlDecomposer } from "@fquery/plugin-gemini";

const sourcePath = new URL("../fixtures/benchmark-raw/nonlinear-google-finland-live/source.json", import.meta.url);
const outPath = new URL("../fixtures/benchmark-raw/nonlinear-google-finland-live/candidate-b.gemini.raw.json", import.meta.url);
const source = JSON.parse(await readFile(sourcePath, "utf8"));

const decomposer = new GeminiNlDecomposer({
  model: "gemini-3.5-flash",
  credentialName: "gemini-local",
  credentialSources: standaloneCredentialSources(new URL("..", import.meta.url).pathname),
});

const outcome = await decomposer.decompose({
  requestId: "request://fquery/nonlinear-eval/google-finland-live/candidate-b",
  queryRef: "query://fquery/nonlinear-eval/google-finland-live",
  profile: "nl",
  observation: { mediaType: "text/plain", payload: source.excerpt },
});

await writeFile(outPath, JSON.stringify(outcome, null, 2) + "\n", "utf8");
console.log(JSON.stringify({ status: outcome.status, hasFam: "fam" in outcome, savedTo: outPath.pathname }, null, 2));
