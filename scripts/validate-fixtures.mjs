import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const roots = ["fixtures/valid", "fixtures/negative", "fixtures/benchmark", "fixtures/ui"];
const statusAxes = {
  resolution_status: ["unresolved", "resolved", "bottom", "unknown"],
  connection_status: ["unconnected", "connected", "not-applicable"],
  transport_status: ["not-started", "running", "succeeded", "failed", "unknown"],
  plugin_status: ["not-requested", "resolved", "plugin-not-found", "rejected", "unknown"],
  semantic_status: ["not-evaluated", "satisfied", "semantic-unsatisfied", "unknown"],
  lambda_status: ["not-evaluated", "satisfied", "unsatisfied", "unknown"],
  control_status: ["continue", "result", "bottom", "last-order", "cancelled"],
};

let count = 0;
for (const root of roots) {
  for (const name of await readdir(root)) {
    if (!name.endsWith(".json")) continue;
    const path = join(root, name);
    const value = JSON.parse(await readFile(path, "utf8"));
    if (!value.schema_version) throw new Error(`${path}: schema_versionがありません`);
    if (value.schema_version === "fquery.result/0.1.0-draft") validateResult(path, value);
    if (value.schema_version === "fquery.benchmark/0.1.0-draft") validateBenchmark(path, value);
    if (value.schema_version === "fquery.ui/0.1.0-draft") validateUi(path, value);
    count += 1;
  }
}

console.log(`fixture validation: ${count} files OK`);

function validateResult(path, value) {
  if (typeof value.query_ref !== "string" || !Array.isArray(value.evidence_refs)) throw new Error(`${path}: result envelopeが不正です`);
  for (const [axis, allowed] of Object.entries(statusAxes)) {
    if (!allowed.includes(value[axis])) throw new Error(`${path}: ${axis}=${value[axis]}は未定義です`);
  }
  if (value.reason === "cycle-detected" && value.control_status !== "bottom") throw new Error(`${path}: cycleはbottomで停止する必要があります`);
}

function validateBenchmark(path, value) {
  if (value.query?.operator !== "Q" || !Array.isArray(value.compare_axes)) throw new Error(`${path}: benchmark contractが不正です`);
  for (const axis of value.compare_axes) if (!(axis in statusAxes)) throw new Error(`${path}: compare axis ${axis}は未定義です`);
}

function validateUi(path, value) {
  if (!Array.isArray(value.nodes) || value.nodes.length === 0) throw new Error(`${path}: nodesがありません`);
  for (const node of value.nodes) {
    if (typeof node.nodeId !== "string" || !Array.isArray(node.badges) || !Array.isArray(node.ports)) throw new Error(`${path}: NodeViewModelが不正です`);
  }
}
