import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const originReceiptPath = new URL(
  "../proton/origins/FoldAccessMapper.0.2.1-alpha.origin.json",
  import.meta.url,
);

const receipt = JSON.parse(await readFile(originReceiptPath, "utf8"));
const artifactPath = new URL(`../proton/origins/${receipt.artifact}`, import.meta.url);
const artifact = await readFile(artifactPath);
const actualSha256 = createHash("sha256").update(artifact).digest("hex");

const failures = [];
if (artifact.byteLength !== receipt.source.byte_count) {
  failures.push(`byte_count: expected=${receipt.source.byte_count} actual=${artifact.byteLength}`);
}
if (actualSha256 !== receipt.source.sha256) {
  failures.push(`sha256: expected=${receipt.source.sha256} actual=${actualSha256}`);
}
if (receipt.preservation.source_mutation !== false) {
  failures.push("source_mutationはfalseでなければなりません");
}
if (receipt.preservation.text_normalization !== false) {
  failures.push("text_normalizationはfalseでなければなりません");
}

if (failures.length > 0) {
  throw new Error(`origin integrity verification failed\n${failures.join("\n")}`);
}

console.log(
  `origin integrity: ${receipt.artifact} ${artifact.byteLength} bytes sha256=${actualSha256} OK`,
);
