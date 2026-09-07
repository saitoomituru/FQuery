import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const roots = ["fixtures/valid", "fixtures/negative", "fixtures/benchmark", "fixtures/famlog", "fixtures/ui"];
const knownSchemas = new Set([
  "fquery.result/0.1.0-draft",
  "fquery.benchmark/0.1.0-draft",
  "fquery.famlog/0.1.0-draft",
  "fquery.famlog-diff/0.1.0-draft",
  "fquery.ui/0.1.0-draft",
  "fam.json/0.1.0-draft",
]);
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
    if (!knownSchemas.has(value.schema_version)) throw new Error(`${path}: 未対応schema_version ${value.schema_version}です`);
    if (value.schema_version === "fquery.result/0.1.0-draft") validateResult(path, value);
    if (value.schema_version === "fquery.benchmark/0.1.0-draft") validateBenchmark(path, value);
    if (value.schema_version === "fquery.famlog/0.1.0-draft") validateFamLog(path, value);
    if (value.schema_version === "fquery.famlog-diff/0.1.0-draft") validateFamLogDiff(path, value);
    if (value.schema_version === "fquery.ui/0.1.0-draft") validateUi(path, value);
    if (value.schema_version === "fam.json/0.1.0-draft") validateFam(path, value);
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

function validateFamLog(path, value) {
  if (!Array.isArray(value.entries) || value.entries.length === 0) throw new Error(`${path}: entriesがありません`);
  value.entries.forEach((entry, index) => {
    if (entry.sequence !== index + 1 || typeof entry.event_type !== "string" || typeof entry.query_ref !== "string") {
      throw new Error(`${path}: entry ${index + 1}が不正です`);
    }
  });
}

function validateFamLogDiff(path, value) {
  if (typeof value.left_ref !== "string" || typeof value.right_ref !== "string" || !Array.isArray(value.differences)) {
    throw new Error(`${path}: diff envelopeが不正です`);
  }
}

function validateFam(path, value) {
  for (const field of ["fam_id", "revision_id", "kind", "title"]) {
    if (typeof value[field] !== "string" || value[field].length === 0) throw new Error(`${path}: ${field}がありません`);
  }
  if (!Array.isArray(value.index_subjects) || !Array.isArray(value.pointers) || !isRecord(value.provenance)) throw new Error(`${path}: FAM top-level metadataが不正です`);
  validateFamNode(path, "$", value);
  if (!isRecord(value.ψ) || typeof value.ψ.source_text !== "string") throw new Error(`${path}: ψ.source_textがありません`);
  if (typeof value.ψ.source_language !== "string" || value.title_language !== value.ψ.source_language) throw new Error(`${path}: 入力言語とtitle_languageが一致しません`);
  if (!isRecord(value.λ) || !Array.isArray(value.λ.output_units) || value.λ.output_units.length === 0) throw new Error(`${path}: λ.output_unitsがありません`);
  value.λ.output_units.forEach((unit, index) => {
    if (!isRecord(unit.ψ) || typeof unit.ψ.source_text !== "string" || !value.ψ.source_text.includes(unit.ψ.source_text) || unit.ψ.source_language !== value.ψ.source_language) throw new Error(`${path}: output_units[${index}]の原言語系譜が不正です`);
    if (!isRecord(unit.λ) || unit.λ.manifestation !== unit.ψ.source_text || unit.λ.manifestation_language !== value.ψ.source_language || !Array.isArray(unit.λ.sub_splitters)) throw new Error(`${path}: output_units[${index}]の正本またはsub_splitters境界が不正です`);
  });
  if (!isRecord(value.Q) || !Array.isArray(value.Q.unknowns) || value.Q.unknown_is_absence !== false) throw new Error(`${path}: Qのunknown境界が不正です`);
}

function validateFamNode(path, pointer, value) {
  if (!isRecord(value)) throw new Error(`${path}: ${pointer}はFAM nodeではありません`);
  for (const axis of ["ψ", "∇φ", "λ", "Q"]) if (!(axis in value)) throw new Error(`${path}: ${pointer}.${axis}がありません`);
  if (!isRecord(value.Q)) throw new Error(`${path}: ${pointer}.Qはobjectではありません`);
  for (const [key, child] of Object.entries(value)) inspectFamChild(path, `${pointer}.${key}`, child);
}

function inspectFamChild(path, pointer, value) {
  if (Array.isArray(value)) return value.forEach((child, index) => inspectFamChild(path, `${pointer}[${index}]`, child));
  if (!isRecord(value)) return;
  const axisCount = ["ψ", "∇φ", "λ", "Q"].filter((axis) => axis in value).length;
  if (axisCount > 0) validateFamNode(path, pointer, value);
  else for (const [key, child] of Object.entries(value)) inspectFamChild(path, `${pointer}.${key}`, child);
}

function isRecord(value) { return typeof value === "object" && value !== null && !Array.isArray(value); }
