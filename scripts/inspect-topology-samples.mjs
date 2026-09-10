import { readFile } from "node:fs/promises";
import {
  normalizeFamTopology,
  projectTopologyForPresentation,
  projectTopologyForRunner,
  resolveFamModuleGraph,
  validateAdapterCapabilities,
} from "@fquery/core";

const samples = await Promise.all(["sample1.fam.json", "sample2.fam.json", "sample3-1.fam.json", "sample3-2.fam.json"].map(async (name) => [
  name,
  JSON.parse(await readFile(new URL(`../sample/${name}`, import.meta.url), "utf8")),
]));
const byName = new Map(samples);

const inputs = {
  sample1: input("sample1.fam.json", "fam://sample/1", "revision://sample/1/1", "fold://sample/1"),
  sample2: input("sample2.fam.json", "fam://sample/2", "revision://sample/2/1", "fold://sample/2"),
  sample3Main: input("sample3-1.fam.json", "fam://sample/3/main", "revision://sample/3/main/1", "fold://sample/3/main"),
  sample3Manufacturing: input("sample3-2.fam.json", "fam://sample/3/manufacturing", "revision://sample/3/manufacturing/1", "fold://sample/3/manufacturing"),
};
const topologies = {
  sample1: normalizeFamTopology(inputs.sample1),
  sample2: normalizeFamTopology(inputs.sample2),
  sample3: normalizeFamTopology(inputs.sample3Main),
};
const moduleGraph = await resolveFamModuleGraph(inputs.sample3Main, (reference) => {
  if (reference.targetFamRef === "./sample3-2.fam.json") return inputs.sample3Manufacturing;
  return undefined;
});

const receipt = {
  schema_version: "fquery.topology-inspection/0.1.0-draft",
  observation_only: true,
  human_verdict: "pending",
  samples: Object.fromEntries(Object.entries(topologies).map(([name, topology]) => [name, summarize(topology)])),
  sample3_module_graph: {
    inline_expansion: moduleGraph.inlineExpansion,
    modules: moduleGraph.modules.map((module) => ({ module_ref: module.moduleRef, revision_ref: module.revisionRef, fold_ref: module.foldRef })),
    references: moduleGraph.references.map((reference) => ({
      requested_fam_ref: reference.requestedFamRef,
      resolved_module_ref: reference.resolvedModuleRef ?? null,
      status: reference.status,
    })),
    issues: moduleGraph.issues,
  },
  adapter_capability_boundary: {
    objective_fact: validateAdapterCapabilities("objective-fact", ["fact-retrieval", "verifiable-provenance"]),
    subjective_truth: validateAdapterCapabilities("subjective-truth", ["semantic-retrieval", "interpretation-candidates"]),
  },
};

console.log(JSON.stringify(receipt, null, 2));

function input(name, moduleRef, revisionRef, foldRef) {
  const value = byName.get(name);
  if (!value) throw new Error(`sample-not-found:${name}`);
  return { moduleRef, revisionRef, foldRef, value };
}

function summarize(topology) {
  const labelByRef = new Map(topology.nodes.map((node) => [node.nodeRef, node.addressKey ?? (node.nodeRef === topology.rootNodeRef ? "self" : node.sourcePointer)]));
  const runner = projectTopologyForRunner(topology);
  const presentation = projectTopologyForPresentation(topology);
  return {
    module_ref: topology.moduleRef,
    revision_ref: topology.revisionRef,
    fold_ref: topology.foldRef,
    node_count: topology.nodes.length,
    addressable_units: topology.nodes.flatMap((node) => node.addressKey ? [node.addressKey] : []),
    parallel_collections: [...new Set(topology.nodes.flatMap((node) => node.parallelCollectionRef ? [node.parallelCollectionRef] : []))],
    structural_edges: edges(topology, "structural", labelByRef),
    runtime_edges: edges(topology, "runtime", labelByRef),
    runner_dependencies: runner.children.map((child) => ({
      node: labelByRef.get(child.childRef),
      depends_on: child.dependsOn.map((reference) => labelByRef.get(reference)),
    })),
    presentation_source_topology_ref: presentation.sourceTopologyRef,
    runner_source_topology_ref: runner.sourceTopologyRef,
    module_references: topology.moduleReferences.map((reference) => ({ source_node: labelByRef.get(reference.sourceNodeRef), target_fam_ref: reference.targetFamRef })),
    issues: topology.issues,
  };
}

function edges(topology, kind, labelByRef) {
  return topology.edges.filter((edge) => edge.kind === kind).map((edge) => ({
    from: labelByRef.get(edge.fromNodeRef),
    to: labelByRef.get(edge.toNodeRef),
    layer_refs: edge.layerRefs,
  }));
}
