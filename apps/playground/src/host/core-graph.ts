import { corePortId, deriveFoldBoundaryMetrics, statusTone, type NodeViewModel, type PresentationSession, type PresentationSessionState } from "@fquery/ui-core";
import { projectDecompositionUnits, projectSemanticTopology, type AccessMapProfile, type FamJsonRecord, type SemanticTopologyRelation } from "@fquery/fam-core";
import type { FoldReprojectionResult } from "@fquery/core";

export interface CoreNodeIds {
  readonly psi?: string | undefined;
  readonly famvim?: string | undefined;
  readonly lambda?: string | undefined;
  readonly gradients?: readonly string[] | undefined;
}

export function layoutSlotRef(nodeId: string): string {
  return `layout://playground/${nodeId}`;
}

/** Core 3 nodeをpluginなしで構築する。接続の可否はportへ委譲する。 */
export async function buildCoreGraph(session: PresentationSession): Promise<CoreNodeIds> {
  const psi = await addCoreNode(session, "core.psi.nl-input", 1);
  const famvim = await addCoreNode(session, "core.gradient.famvim", 2);
  const lambda = await addCoreNode(session, "core.lambda.nl-output", 3);
  if (psi && famvim) await session.dispatch({ type: "connection.add.requested", requestId: "playground:connect:psi-famvim", fromPortId: corePortId(psi, "observation"), toPortId: corePortId(famvim, "psi") });
  if (famvim && lambda) await session.dispatch({ type: "connection.add.requested", requestId: "playground:connect:famvim-lambda", fromPortId: corePortId(famvim, "fam"), toPortId: corePortId(lambda, "fam") });
  const positions = [psi, famvim, lambda].map((nodeId, index) => ({ nodeId, x: 40 + index * 380, y: 80 }));
  for (const position of positions) {
    if (!position.nodeId) continue;
    await session.dispatch({ type: "node.move.requested", requestId: `playground:layout:${position.nodeId}`, nodeId: position.nodeId, layoutSlotRef: layoutSlotRef(position.nodeId), x: position.x, y: position.y });
  }
  return { psi, famvim, lambda };
}

export async function addCoreNode(session: PresentationSession, capability: string, sequence: number): Promise<string | undefined> {
  const state = await session.dispatch({ type: "node.add.requested", requestId: `playground:add:${sequence}`, capability });
  const decision = state.decisions.at(-1);
  return decision?.kind === "node.add" && decision.status === "accepted" ? decision.node?.nodeId : undefined;
}

let graphSequence = 10;

/**
 * canonical decomposition FAMをroot Fold boundaryへ収容する。
 * semantic topologyはAccess Mapperで選択されたbranchだけを描画し、未宣言時にunit順を因果鎖へ捏造しない。
 */
export async function projectDecompositionGraph(
  session: PresentationSession,
  current: CoreNodeIds,
  fam: FamJsonRecord,
  accessMap: AccessMapProfile,
): Promise<CoreNodeIds> {
  const previousGradients = [...new Set(current.gradients ?? [])].sort((left, right) => {
    const leftDepth = session.state.nodes.find((node) => node.nodeId === left)?.depth ?? 0;
    const rightDepth = session.state.nodes.find((node) => node.nodeId === right)?.depth ?? 0;
    return rightDepth - leftDepth;
  });
  for (const nodeId of previousGradients) {
    graphSequence += 1;
    await session.dispatch({ type: "node.remove.requested", requestId: `playground:remove-gradient:${graphSequence}`, nodeId });
  }
  if (!current.famvim) throw new TypeError("root-fold-boundary-node-not-provided");
  const rootNode = session.state.nodes.find((candidate) => candidate.nodeId === current.famvim);
  if (!rootNode) throw new TypeError("root-fold-boundary-node-not-found");
  const units = projectDecompositionUnits(fam, accessMap);
  const topology = projectSemanticTopology(fam, accessMap);
  const relations = topology.selectedBranch?.relations ?? [];
  const unitRefs = units.map((unit) => unit.unitRef);
  const containment = semanticContainment(unitRefs, relations);
  const rootRelations = boundaryRelations(undefined, containment, relations);
  const rootLayout = boundaryLayout(containment.topLevelRefs, rootRelations, containment);
  const boundaryWidth = rootLayout.width;
  const boundaryHeight = rootLayout.height;
  const boundaryNodeId = current.famvim;
  const boundaryPresentation = {
    targetRef: boundaryNodeId,
    mode: "native" as const,
    rendererId: "react-flow",
    presentation: {
      schemaVersion: "fquery.presentation-fam/0.1.0-draft" as const,
      presentationId: "presentation://fquery/core/fold-boundary",
      targetRef: boundaryNodeId,
      surfaces: ["node-editor" as const, "inspector" as const],
      visualRole: "fold-boundary",
      interfaceRoles: ["atomic-resolution", "single-processing-unit", "semantic-topology"],
      visibility: "visible" as const,
      rendererHint: "fquery-fold-boundary",
      category: "Core",
      aliases: ["Fold", "G/D/L/mL/S"],
      layoutSlotRef: layoutSlotRef(boundaryNodeId),
    },
  };
  const boundaryNode: NodeViewModel = {
    ...rootNode,
    label: `Fold · ${fam.title}`,
    badges: [
      { axis: "fold", value: "complete", tone: "success" },
      { axis: "topology", value: topology.status, tone: topology.status === "selected" ? "active" : "unknown" },
    ],
    ports: [
      { portId: corePortId(boundaryNodeId, "psi"), label: "外Ψ", direction: "input", connectionStatus: "unconnected", cardinality: "one" },
      { portId: corePortId(boundaryNodeId, "children"), label: "内Ψ", direction: "output", connectionStatus: "unconnected", cardinality: "many" },
      { portId: corePortId(boundaryNodeId, "return"), label: "内λ", direction: "input", connectionStatus: "unconnected", cardinality: "many" },
      { portId: corePortId(boundaryNodeId, "fam"), label: "外λ", direction: "output", connectionStatus: "unconnected", cardinality: "one" },
    ],
    value: { fam, semanticTopology: topology },
    evidenceRefs: [`${accessMap.famId}@${accessMap.revisionId}`, ...(topology.selectedBranch ? [topology.selectedBranch.branchRef] : [])],
    foldRef: fam.fam_id,
    revisionRef: fam.revision_id,
    depth: 0,
    collapsed: false,
    projectionFreshness: "fresh",
    foldBoundary: {
      boundaryRef: `fold-boundary://${fam.fam_id}`,
      rootFoldRef: fam.fam_id,
      childFoldRefs: containment.topLevelRefs,
      resolutionMode: "atomic-resolution",
      dispatchMode: "single-processing-unit",
      closesAxes: ["G", "D", "L", "mL"],
      generation: 1,
      status: "complete",
      boundaryMetrics: topologyMetrics(containment.topLevelRefs, units.flatMap((unit) => unit.classification.dimensionRef ?? []), relations, 0),
      width: boundaryWidth,
      height: boundaryHeight,
    },
    presentation: boundaryPresentation,
  };
  session.applyEngineEvent({ type: "fam.node.changed", node: boundaryNode });
  session.applyEngineEvent({ type: "presentation.changed", targetRef: boundaryNodeId, projection: boundaryPresentation });
  const gradients: string[] = [];
  const nodeByUnitRef = new Map<string, string>();
  const originalNodeByUnitRef = new Map<string, NodeViewModel>();
  // React Flowはparentをchildより前に受け取る必要があるため、providerのunit配列順には依存しない。
  const orderedUnits = [...units].sort((left, right) => (containment.depthByRef.get(left.unitRef) ?? 1) - (containment.depthByRef.get(right.unitRef) ?? 1) || left.order - right.order);
  for (const unit of orderedUnits) {
    graphSequence += 1;
    const nodeId = await addCoreNode(session, "core.gradient.famvim", graphSequence);
    if (!nodeId) continue;
    gradients.push(nodeId);
    nodeByUnitRef.set(unit.unitRef, nodeId);
    originalNodeByUnitRef.set(unit.unitRef, session.state.nodes.find((candidate) => candidate.nodeId === nodeId)!);
  }
  for (const unit of orderedUnits) {
    const nodeId = nodeByUnitRef.get(unit.unitRef);
    const node = originalNodeByUnitRef.get(unit.unitRef);
    if (!nodeId || !node) continue;
    const semanticParentRef = containment.parentByChild.get(unit.unitRef);
    const parentNodeId = semanticParentRef ? nodeByUnitRef.get(semanticParentRef) : boundaryNodeId;
    if (!parentNodeId) throw new TypeError("semantic-containment-parent-node-not-found");
    const directChildren = containment.childrenByParent.get(unit.unitRef) ?? [];
    const isBoundary = directChildren.length > 0;
    const depth = containment.depthByRef.get(unit.unitRef) ?? 1;
    const position = semanticParentRef
      ? nestedPosition(unit.unitRef, semanticParentRef, containment)
      : rootLayout.positions.get(unit.unitRef) ?? { x: 60, y: 120 };
    const subtreeRefs = containment.descendantsByRef.get(unit.unitRef) ?? Object.freeze([unit.unitRef]);
    const subtreeRelations = relations.filter((relation) => subtreeRefs.includes(relation.fromUnitRef) && subtreeRefs.includes(relation.toUnitRef));
    const subtreeUnits = units.filter((candidate) => subtreeRefs.includes(candidate.unitRef));
    const size = containment.sizeByRef.get(unit.unitRef) ?? { width: 320, height: 280 };
    const semanticBoundary = isBoundary ? semanticFoldBoundaryPresentation(nodeId) : undefined;
    session.applyEngineEvent({
      type: "fam.node.changed",
      node: {
        ...node,
        label: isBoundary ? `Fold · ∇φ-${unit.order + 1}` : `∇φ-${unit.order + 1}`,
        foldRef: unit.unitRef,
        parentFoldRef: semanticParentRef ?? unit.parentFamRef,
        parentNodeId,
        depth,
        revisionRef: unit.unitRevisionRef,
        collapsed: false,
        projectionFreshness: "fresh",
        value: { unit: unit.value, classification: unit.classification, sourcePointer: unit.sourcePointer, semanticTopologyBranchRef: topology.selectedBranch?.branchRef ?? null },
        badges: [
          { axis: "classification", value: unit.classification.dimensionRef ?? "unmapped", tone: unit.classification.status === "mapped" ? "active" : "unknown" },
          { axis: "topology", value: topology.status, tone: topology.status === "selected" ? "active" : "unknown" },
        ],
        evidenceRefs: [`${accessMap.famId}@${accessMap.revisionId}`],
        ...(semanticBoundary ? {
          ports: [
            { portId: corePortId(nodeId, "psi"), label: "外Ψ", direction: "input", connectionStatus: "unconnected", cardinality: "many" },
            { portId: corePortId(nodeId, "children"), label: "内Ψ", direction: "output", connectionStatus: "unconnected", cardinality: "many" },
            { portId: corePortId(nodeId, "return"), label: "内λ", direction: "input", connectionStatus: "unconnected", cardinality: "many" },
            { portId: corePortId(nodeId, "fam"), label: "外λ", direction: "output", connectionStatus: "unconnected", cardinality: "one" },
          ],
          foldBoundary: {
            boundaryRef: `fold-boundary://${fam.fam_id}/semantic/${encodeURIComponent(unit.unitRef)}`,
            rootFoldRef: unit.unitRef,
            childFoldRefs: directChildren,
            resolutionMode: "atomic-resolution",
            dispatchMode: "single-processing-unit",
            closesAxes: ["G", "D", "L", "mL"],
            generation: 1,
            status: "complete",
            boundaryMetrics: topologyMetrics(directChildren, subtreeUnits.flatMap((candidate) => candidate.classification.dimensionRef ?? []), subtreeRelations, depth),
            width: size.width,
            height: size.height,
          },
          presentation: semanticBoundary,
        } : {}),
      },
    });
    if (semanticBoundary) session.applyEngineEvent({ type: "presentation.changed", targetRef: nodeId, projection: semanticBoundary });
    graphSequence += 1;
    await session.dispatch({ type: "node.move.requested", requestId: `playground:layout-root-fold-child:${graphSequence}`, nodeId, layoutSlotRef: layoutSlotRef(nodeId), x: position.x, y: position.y });
  }
  await connectBoundaryGraph(session, boundaryNodeId, undefined, containment, relations, nodeByUnitRef, topology.selectedBranch?.branchRef);
  for (const containerRef of containment.childrenByParent.keys()) {
    const containerNodeId = nodeByUnitRef.get(containerRef);
    if (containerNodeId) await connectBoundaryGraph(session, containerNodeId, containerRef, containment, relations, nodeByUnitRef, topology.selectedBranch?.branchRef);
  }
  await layoutRootFold(session, current.psi, boundaryNodeId, boundaryWidth, boundaryHeight, current.lambda);
  return Object.freeze({ psi: current.psi, famvim: boundaryNodeId, lambda: current.lambda, gradients: Object.freeze(gradients) });
}

interface SemanticContainment {
  readonly parentByChild: ReadonlyMap<string, string>;
  readonly childrenByParent: ReadonlyMap<string, readonly string[]>;
  readonly topLevelRefs: readonly string[];
  readonly depthByRef: ReadonlyMap<string, number>;
  readonly descendantsByRef: ReadonlyMap<string, readonly string[]>;
  readonly sizeByRef: ReadonlyMap<string, { readonly width: number; readonly height: number }>;
}

interface BoundaryGraphLayout {
  readonly width: number;
  readonly height: number;
  readonly positions: ReadonlyMap<string, { readonly x: number; readonly y: number }>;
}

function semanticContainment(unitRefs: readonly string[], relations: readonly SemanticTopologyRelation[]): SemanticContainment {
  const known = new Set(unitRefs);
  const parentByChild = new Map<string, string>();
  const childrenByParent = new Map<string, string[]>();
  for (const relation of relations.filter((candidate) => candidate.relationKind === "parent-child")) {
    if (!known.has(relation.fromUnitRef) || !known.has(relation.toUnitRef)) throw new TypeError("semantic-containment-unit-ref-not-found");
    const previous = parentByChild.get(relation.toUnitRef);
    if (previous && previous !== relation.fromUnitRef) throw new TypeError("semantic-containment-multiple-parents");
    parentByChild.set(relation.toUnitRef, relation.fromUnitRef);
    const children = childrenByParent.get(relation.fromUnitRef) ?? [];
    if (!children.includes(relation.toUnitRef)) childrenByParent.set(relation.fromUnitRef, [...children, relation.toUnitRef]);
  }
  const topLevelRefs = Object.freeze(unitRefs.filter((ref) => !parentByChild.has(ref)));
  const depthByRef = new Map<string, number>();
  const descendantsByRef = new Map<string, readonly string[]>();
  const sizeByRef = new Map<string, { readonly width: number; readonly height: number }>();
  const visiting = new Set<string>();
  const visit = (ref: string, depth: number): readonly string[] => {
    if (visiting.has(ref)) throw new TypeError("semantic-containment-cycle");
    visiting.add(ref);
    depthByRef.set(ref, depth);
    const children = childrenByParent.get(ref) ?? [];
    const descendants = Object.freeze([ref, ...children.flatMap((child) => visit(child, depth + 1))]);
    descendantsByRef.set(ref, descendants);
    const childSizes = children.map((child) => sizeByRef.get(child) ?? { width: 320, height: 280 });
    sizeByRef.set(ref, children.length === 0
      ? Object.freeze({ width: 320, height: 280 })
      : Object.freeze({ width: Math.max(660, ...childSizes.map((size) => size.width + 120)), height: Math.max(420, 140 + childSizes.reduce((sum, size) => sum + size.height + 40, 0)) }));
    visiting.delete(ref);
    return descendants;
  };
  for (const ref of topLevelRefs) visit(ref, 1);
  if (depthByRef.size !== unitRefs.length) throw new TypeError("semantic-containment-root-not-found");
  return Object.freeze({ parentByChild, childrenByParent, topLevelRefs, depthByRef, descendantsByRef, sizeByRef });
}

function directChildUnderBoundary(ref: string, boundaryRef: string | undefined, containment: SemanticContainment): string | undefined {
  let current = ref;
  const visited = new Set<string>();
  while (true) {
    if (visited.has(current)) throw new TypeError("semantic-containment-cycle");
    visited.add(current);
    const parent = containment.parentByChild.get(current);
    if (parent === boundaryRef || (boundaryRef === undefined && parent === undefined)) return current;
    if (parent === undefined) return undefined;
    current = parent;
  }
}

function boundaryRelations(boundaryRef: string | undefined, containment: SemanticContainment, relations: readonly SemanticTopologyRelation[]): readonly SemanticTopologyRelation[] {
  const projected: SemanticTopologyRelation[] = [];
  const keys = new Set<string>();
  for (const relation of relations) {
    if (relation.relationKind === "parent-child") continue;
    const fromUnitRef = directChildUnderBoundary(relation.fromUnitRef, boundaryRef, containment);
    const toUnitRef = directChildUnderBoundary(relation.toUnitRef, boundaryRef, containment);
    if (!fromUnitRef || !toUnitRef || fromUnitRef === toUnitRef) continue;
    const key = `${fromUnitRef}\u0000${toUnitRef}\u0000${relation.axis}\u0000${relation.relationKind}`;
    if (keys.has(key)) continue;
    keys.add(key);
    projected.push(Object.freeze({ ...relation, fromUnitRef, toUnitRef }));
  }
  return Object.freeze(projected);
}

function boundaryLayout(childRefs: readonly string[], relations: readonly SemanticTopologyRelation[], containment: SemanticContainment): BoundaryGraphLayout {
  const levels = semanticLevels(childRefs, relations);
  const refsByLevel = new Map<number, string[]>();
  for (const ref of childRefs) {
    const level = levels.get(ref) ?? 0;
    refsByLevel.set(level, [...(refsByLevel.get(level) ?? []), ref]);
  }
  const maxLevel = Math.max(0, ...levels.values());
  const columnWidths = Array.from({ length: maxLevel + 1 }, (_, level) => Math.max(320, ...(refsByLevel.get(level) ?? []).map((ref) => containment.sizeByRef.get(ref)?.width ?? 320)));
  const columnX: number[] = [];
  let cursorX = 60;
  for (const width of columnWidths) { columnX.push(cursorX); cursorX += width + 80; }
  const positions = new Map<string, { readonly x: number; readonly y: number }>();
  let maxColumnHeight = 0;
  for (let level = 0; level <= maxLevel; level += 1) {
    let cursorY = 120;
    for (const ref of refsByLevel.get(level) ?? []) {
      positions.set(ref, Object.freeze({ x: columnX[level] ?? 60, y: cursorY }));
      cursorY += (containment.sizeByRef.get(ref)?.height ?? 280) + 40;
    }
    maxColumnHeight = Math.max(maxColumnHeight, cursorY);
  }
  return Object.freeze({ width: Math.max(760, cursorX + 20), height: Math.max(460, maxColumnHeight + 60), positions });
}

function nestedPosition(ref: string, parentRef: string, containment: SemanticContainment): { readonly x: number; readonly y: number } {
  const siblings = containment.childrenByParent.get(parentRef) ?? [];
  let y = 120;
  for (const sibling of siblings) {
    if (sibling === ref) return Object.freeze({ x: 60, y });
    y += (containment.sizeByRef.get(sibling)?.height ?? 280) + 40;
  }
  throw new TypeError("semantic-containment-child-not-found");
}

function semanticFoldBoundaryPresentation(nodeId: string) {
  return {
    targetRef: nodeId,
    mode: "native" as const,
    rendererId: "react-flow",
    presentation: {
      schemaVersion: "fquery.presentation-fam/0.1.0-draft" as const,
      presentationId: "presentation://fquery/core/fold-boundary",
      targetRef: nodeId,
      surfaces: ["node-editor" as const, "inspector" as const],
      visualRole: "fold-boundary",
      interfaceRoles: ["atomic-resolution", "single-processing-unit", "semantic-containment"],
      visibility: "visible" as const,
      rendererHint: "fquery-fold-boundary",
      category: "Core",
      aliases: ["Fold", "G/D/L/mL/S"],
      layoutSlotRef: layoutSlotRef(nodeId),
    },
  };
}

async function connectBoundaryGraph(
  session: PresentationSession,
  boundaryNodeId: string,
  boundaryRef: string | undefined,
  containment: SemanticContainment,
  relations: readonly SemanticTopologyRelation[],
  nodeByUnitRef: ReadonlyMap<string, string>,
  branchRef?: string,
): Promise<void> {
  const childRefs = boundaryRef === undefined ? containment.topLevelRefs : containment.childrenByParent.get(boundaryRef) ?? [];
  const projected = boundaryRelations(boundaryRef, containment, relations);
  const incoming = new Set(projected.map((relation) => relation.toUnitRef));
  const outgoing = new Set(projected.map((relation) => relation.fromUnitRef));
  for (const childRef of childRefs) {
    const childNodeId = nodeByUnitRef.get(childRef);
    if (!childNodeId) continue;
    if (!incoming.has(childRef)) {
      graphSequence += 1;
      await session.dispatch({ type: "connection.add.requested", requestId: `playground:connect-boundary-child:${graphSequence}`, fromPortId: corePortId(boundaryNodeId, "children"), toPortId: corePortId(childNodeId, "psi"), relationKind: "parent-child", relationStatus: "active", gateRef: branchRef ?? "topology://not-declared" });
    }
    if (!outgoing.has(childRef)) {
      graphSequence += 1;
      await session.dispatch({ type: "connection.add.requested", requestId: `playground:connect-child-return:${graphSequence}`, fromPortId: corePortId(childNodeId, "fam"), toPortId: corePortId(boundaryNodeId, "return"), relationKind: "parent-child", relationStatus: "active", gateRef: branchRef ?? "topology://not-declared" });
    }
  }
  for (const relation of projected) {
    const fromNodeId = nodeByUnitRef.get(relation.fromUnitRef);
    const toNodeId = nodeByUnitRef.get(relation.toUnitRef);
    if (!fromNodeId || !toNodeId) continue;
    graphSequence += 1;
    const gateRef = relation.evidenceRefs[0] ?? branchRef;
    await session.dispatch({ type: "connection.add.requested", requestId: `playground:connect-semantic:${graphSequence}`, fromPortId: corePortId(fromNodeId, "fam"), toPortId: corePortId(toNodeId, "psi"), relationKind: relation.relationKind, relationStatus: "active", ...(gateRef ? { gateRef } : {}) });
  }
}

function topologyMetrics(unitRefs: readonly string[], dimensionRefs: readonly string[], relations: readonly SemanticTopologyRelation[], nestingDepth: number) {
  const technologyEdges = relations.filter((relation) => relation.axis === "L").map((relation) => ({ fromNodeRef: relation.fromUnitRef, toNodeRef: relation.toUnitRef }));
  const metaEdges = relations.filter((relation) => relation.axis === "mL").map((relation) => ({ fromNodeRef: relation.fromUnitRef, toNodeRef: relation.toUnitRef }));
  const technologyNodeRefs = [...new Set(technologyEdges.flatMap((edge) => [edge.fromNodeRef, edge.toNodeRef]))];
  const metaContextNodeRefs = [...new Set(metaEdges.flatMap((edge) => [edge.fromNodeRef, edge.toNodeRef]))];
  return deriveFoldBoundaryMetrics({ directChildNodeRefs: unitRefs, contextDimensionRefs: dimensionRefs, nestingPathDepths: [nestingDepth], technologyNodeRefs, technologyChainEdges: technologyEdges, requiredTechnologyRoutes: [], metaContextNodeRefs, metaContextChainEdges: metaEdges, nodePluginAvailable: true, exitAdapterRef: "adapter://fquery/playground/lambda-fixture-projection" });
}

function semanticLevels(unitRefs: readonly string[], relations: readonly SemanticTopologyRelation[]): ReadonlyMap<string, number> {
  const incoming = new Map(unitRefs.map((ref) => [ref, [] as string[]]));
  for (const relation of relations) incoming.get(relation.toUnitRef)?.push(relation.fromUnitRef);
  const memo = new Map<string, number>();
  const visiting = new Set<string>();
  const levelOf = (ref: string): number => {
    if (visiting.has(ref)) throw new TypeError("semantic-topology-cycle");
    const known = memo.get(ref);
    if (known !== undefined) return known;
    visiting.add(ref);
    const parents = incoming.get(ref) ?? [];
    const level = parents.length === 0 ? 0 : Math.max(...parents.map(levelOf)) + 1;
    visiting.delete(ref);
    memo.set(ref, level);
    return level;
  };
  for (const ref of unitRefs) levelOf(ref);
  return memo;
}

/** 「なんで？-DeFold-」の子decompositionを、親unit identityを保った階層nodeとして追加する。 */
export interface RecursiveFoldProjection {
  readonly boundaryNodeId: string;
  readonly childNodeIds: readonly string[];
  readonly replacedNode: NodeViewModel;
}

/** Fold境界配下を子から除去し、同一IDで置換した元unitを復元する。 */
export async function removeRecursiveFoldProjection(session: PresentationSession, projection: RecursiveFoldProjection): Promise<void> {
  for (const nodeId of projection.childNodeIds) {
    if (!session.state.nodes.some((node) => node.nodeId === nodeId)) continue;
    graphSequence += 1;
    await session.dispatch({ type: "node.remove.requested", requestId: `playground:remove-recursive-fold:${graphSequence}`, nodeId });
  }
  session.applyEngineEvent({ type: "fam.node.changed", node: projection.replacedNode });
  if (projection.replacedNode.presentation) {
    session.applyEngineEvent({ type: "presentation.changed", targetRef: projection.boundaryNodeId, projection: projection.replacedNode.presentation });
  }
}

/** 親unitへRunnerの状態を投影し、「なんで？-DeFold-」のbusy表示をsession stateと同期する。 */
export function setRecursiveFoldStatus(session: PresentationSession, nodeId: string, status: "running" | "complete" | "failed" | "cancelled"): void {
  const node = session.state.nodes.find((candidate) => candidate.nodeId === nodeId);
  if (!node) return;
  session.applyEngineEvent({
    type: "fam.node.changed",
    node: {
      ...node,
      badges: [...node.badges.filter((badge) => badge.axis !== "recursive"), { axis: "recursive", value: status, tone: statusTone(status) }],
      canCancel: status === "running",
    },
  });
}

/** unit局所差替えの要求・採否をcanvas上へ返し、無反応に見える状態を作らない。 */
export function setUnitEditStatus(session: PresentationSession, nodeId: string, status: "requested" | "accepted" | "rejected"): void {
  const node = session.state.nodes.find((candidate) => candidate.nodeId === nodeId);
  if (!node) return;
  session.applyEngineEvent({
    type: "fam.node.changed",
    node: {
      ...node,
      badges: [...node.badges.filter((badge) => badge.axis !== "edit"), { axis: "edit", value: status, tone: statusTone(status) }],
    },
  });
}

/** Foldの意味構造を残したまま、canvas投影だけを縮約または再展開する。 */
export function setFoldBoundaryCollapsed(session: PresentationSession, nodeId: string, collapsed: boolean): boolean {
  const node = session.state.nodes.find((candidate) => candidate.nodeId === nodeId);
  if (!node?.foldBoundary) return false;
  session.applyEngineEvent({ type: "fam.node.changed", node: { ...node, collapsed } });
  return true;
}

export async function projectRecursiveDecompositionGraph(
  session: PresentationSession,
  parentNodeId: string,
  fam: FamJsonRecord,
  accessMap: AccessMapProfile,
  generation = 1,
): Promise<RecursiveFoldProjection> {
  const parent = session.state.nodes.find((node) => node.nodeId === parentNodeId);
  if (!parent?.foldRef) throw new TypeError("recursive-parent-fold-ref-required");
  graphSequence += 1;
  // Foldは親unitの隣へ増設せず、同じstable node IDを保ったまま表示・実行境界へ昇格する。
  // これにより既存の外Ψ→親→外λ connectionは切断せず、そのまま境界gateへ接続される。
  const boundaryNodeId = parentNodeId;
  const boundaryRef = `fold-boundary://${parent.foldRef}/generation/${generation}`;
  const boundaryDepth = parent.depth ?? 0;
  const gravityDepth = foldBoundaryAncestorCount(session, parentNodeId) + 1;
  const boundaryWidth = 760;
  const units = projectDecompositionUnits(fam, accessMap);
  const boundaryHeight = Math.max(460, units.length * 340 + 120);
  const boundaryPresentation = { targetRef: boundaryNodeId, mode: "native" as const, rendererId: "react-flow", presentation: { schemaVersion: "fquery.presentation-fam/0.1.0-draft" as const, presentationId: "presentation://fquery/core/fold-boundary", targetRef: boundaryNodeId, surfaces: ["node-editor" as const, "inspector" as const], visualRole: "fold-boundary", interfaceRoles: ["atomic-resolution", "single-processing-unit"], visibility: "visible" as const, rendererHint: "fquery-fold-boundary", category: "Core", aliases: ["Fold", "D/G/L/S"], layoutSlotRef: layoutSlotRef(boundaryNodeId) } };
  const boundaryNode: NodeViewModel = {
    nodeId: boundaryNodeId,
    label: `Fold · ${parent.label}`,
    badges: [{ axis: "fold", value: "running", tone: "notice" }],
    ports: [
      { portId: corePortId(boundaryNodeId, "psi"), label: "外Ψ", direction: "input", connectionStatus: "unconnected", cardinality: "one" },
      { portId: corePortId(boundaryNodeId, "children"), label: "内Ψ", direction: "output", connectionStatus: "unconnected", cardinality: "many" },
      { portId: corePortId(boundaryNodeId, "return"), label: "内λ", direction: "input", connectionStatus: "unconnected", cardinality: "many" },
      { portId: corePortId(boundaryNodeId, "fam"), label: "外λ", direction: "output", connectionStatus: "unconnected", cardinality: "one" },
    ],
    value: { sourceUnit: parent.value, childFamRef: fam.fam_id, childRevisionRef: fam.revision_id },
    evidenceRefs: [`${accessMap.famId}@${accessMap.revisionId}`],
    canExecute: false,
    canCancel: true,
    foldRef: parent.foldRef,
    ...(parent.parentFoldRef ? { parentFoldRef: parent.parentFoldRef } : {}),
    ...(parent.parentNodeId ? { parentNodeId: parent.parentNodeId } : {}),
    depth: boundaryDepth,
    revisionRef: fam.revision_id,
    projectionFreshness: "unknown",
    foldBoundary: { boundaryRef, rootFoldRef: parent.foldRef, childFoldRefs: [], resolutionMode: "atomic-resolution", dispatchMode: "single-processing-unit", closesAxes: ["G", "D", "L", "mL"], generation, status: "running", boundaryMetrics: deriveFoldBoundaryMetrics({ directChildNodeRefs: [], contextDimensionRefs: units.flatMap((unit) => unit.classification.dimensionRef ?? []), nestingPathDepths: [gravityDepth], technologyNodeRefs: [], technologyChainEdges: [], requiredTechnologyRoutes: [], metaContextNodeRefs: [], metaContextChainEdges: [], nodePluginAvailable: true, exitAdapterRef: "adapter://fquery/playground/lambda-fixture-projection" }), width: boundaryWidth, height: boundaryHeight },
    presentation: boundaryPresentation,
  };
  session.applyEngineEvent({ type: "fam.node.changed", node: boundaryNode });
  session.applyEngineEvent({ type: "presentation.changed", targetRef: boundaryNodeId, projection: boundaryPresentation });
  const childNodeIds: string[] = [];
  const childFoldRefs: string[] = [];
  for (const unit of units) {
    graphSequence += 1;
    const nodeId = await addCoreNode(session, "core.gradient.famvim", graphSequence);
    if (!nodeId) continue;
    childNodeIds.push(nodeId);
    childFoldRefs.push(unit.unitRef);
    const node = session.state.nodes.find((candidate) => candidate.nodeId === nodeId)!;
    session.applyEngineEvent({ type: "fam.node.changed", node: {
      ...node,
      label: `↳ ∇φ-${unit.order + 1}`,
      foldRef: unit.unitRef,
      parentFoldRef: parent.foldRef,
      parentNodeId: boundaryNodeId,
      depth: boundaryDepth + 1,
      collapsed: false,
      revisionRef: unit.unitRevisionRef,
      projectionFreshness: "fresh",
      value: { unit: unit.value, classification: unit.classification, sourcePointer: unit.sourcePointer, recursiveParentFamRef: fam.fam_id },
      badges: [{ axis: "recursive", value: "child", tone: "notice" }, { axis: "classification", value: unit.classification.dimensionRef ?? "unmapped", tone: unit.classification.status === "mapped" ? "active" : "unknown" }],
      evidenceRefs: [`${accessMap.famId}@${accessMap.revisionId}`, `parent-fold://${parent.foldRef}`],
    } });
    await session.dispatch({
      type: "node.move.requested",
      requestId: `playground:layout-recursive:${graphSequence}`,
      nodeId,
      layoutSlotRef: layoutSlotRef(nodeId),
      x: 60,
      y: 100 + unit.order * 320,
    });
    await session.dispatch({ type: "connection.add.requested", requestId: `playground:connect-boundary-child:${graphSequence}`, fromPortId: corePortId(boundaryNodeId, "children"), toPortId: corePortId(nodeId, "psi") });
    await session.dispatch({ type: "connection.add.requested", requestId: `playground:connect-child-return:${graphSequence}`, fromPortId: corePortId(nodeId, "fam"), toPortId: corePortId(boundaryNodeId, "return") });
  }
  session.applyEngineEvent({ type: "fam.node.changed", node: {
    ...boundaryNode,
    badges: [{ axis: "fold", value: "complete", tone: "success" }],
    projectionFreshness: "fresh",
    foldBoundary: { ...boundaryNode.foldBoundary!, childFoldRefs: Object.freeze(childFoldRefs), status: "complete", boundaryMetrics: deriveFoldBoundaryMetrics({ directChildNodeRefs: childFoldRefs, contextDimensionRefs: units.flatMap((unit) => unit.classification.dimensionRef ?? []), nestingPathDepths: [gravityDepth], technologyNodeRefs: [], technologyChainEdges: [], requiredTechnologyRoutes: [], metaContextNodeRefs: childFoldRefs, metaContextChainEdges: [], nodePluginAvailable: true, exitAdapterRef: "adapter://fquery/playground/lambda-fixture-projection" }) },
  } });
  return Object.freeze({ boundaryNodeId, childNodeIds: Object.freeze(childNodeIds), replacedNode: parent });
}

/** presentation depthではなく、実際に跨いだancestor boundaryだけをGとして数える。 */
function foldBoundaryAncestorCount(session: PresentationSession, nodeId: string): number {
  let count = 0;
  let current = session.state.nodes.find((node) => node.nodeId === nodeId);
  const visited = new Set<string>();
  while (current?.parentNodeId) {
    if (visited.has(current.parentNodeId)) throw new TypeError("fold-boundary-parent-cycle");
    visited.add(current.parentNodeId);
    const parent = session.state.nodes.find((node) => node.nodeId === current!.parentNodeId);
    if (!parent) throw new TypeError("fold-boundary-parent-not-found");
    if (parent.foldBoundary) count += 1;
    current = parent;
  }
  return count;
}

/** unit編集後、node identityとlayoutを維持したまま値・classification・revisionだけを再投影する。 */
export function refreshDecompositionNodes(session: PresentationSession, current: CoreNodeIds, fam: FamJsonRecord, accessMap: AccessMapProfile, reprojection?: FoldReprojectionResult): void {
  const byFold = new Map(projectDecompositionUnits(fam, accessMap).map((unit) => [unit.unitRef, unit]));
  for (const nodeId of current.gradients ?? []) {
    const node = session.state.nodes.find((candidate) => candidate.nodeId === nodeId);
    const unit = node?.foldRef ? byFold.get(node.foldRef) : undefined;
    if (!node || !unit) continue;
    session.applyEngineEvent({
      type: "fam.node.changed",
      node: {
        ...node,
        revisionRef: unit.unitRevisionRef,
        projectionFreshness: reprojection?.affectedFoldRefs.includes(unit.unitRef) ? (reprojection.stale ? "stale" : "fresh") : "fresh",
        value: { unit: unit.value, classification: unit.classification, sourcePointer: unit.sourcePointer },
        badges: [
          ...node.badges.filter((badge) => badge.axis === "edit" || badge.axis === "recursive"),
          { axis: "classification", value: unit.classification.dimensionRef ?? "unmapped", tone: unit.classification.status === "mapped" ? "active" : "unknown" },
          ...(reprojection?.affectedFoldRefs.includes(unit.unitRef) ? [{ axis: "projection", value: reprojection.projectionStatus, tone: reprojection.stale ? "warning" as const : "active" as const }] : []),
        ],
      },
    });
  }
}

async function layoutRootFold(session: PresentationSession, psi: string | undefined, boundaryNodeId: string, boundaryWidth: number, boundaryHeight: number, lambda: string | undefined): Promise<void> {
  const positions = [
    ...(psi ? [{ nodeId: psi, x: 40, y: 80 + Math.max(0, boundaryHeight / 2 - 120) }] : []),
    { nodeId: boundaryNodeId, x: 420, y: 80 },
    ...(lambda ? [{ nodeId: lambda, x: 420 + boundaryWidth + 100, y: 80 + Math.max(0, boundaryHeight / 2 - 80) }] : []),
  ];
  for (const position of positions) {
    graphSequence += 1;
    await session.dispatch({ type: "node.move.requested", requestId: `playground:layout-decomposition:${graphSequence}`, nodeId: position.nodeId, layoutSlotRef: layoutSlotRef(position.nodeId), x: position.x, y: position.y });
  }
}

let placementSequence = 0;

/**
 * Host責務: acceptされたlayoutが無いnodeをviewport中央へ置く。複数あれば縦へずらす。
 * 位置はPresentation FAMではなくlayout write-backとしてsessionへ通す。
 */
export async function placeUnplacedNodes(session: PresentationSession, state: PresentationSessionState, center: { x: number; y: number }): Promise<void> {
  const placed = new Set(state.layout.map((entry) => entry.nodeId));
  const unplaced = state.nodes.filter((node) => !placed.has(node.nodeId));
  const occupied = state.layout.map((entry) => ({ x: entry.x, y: entry.y }));
  for (const node of unplaced) {
    const position = nextFreeSlot(occupied, { x: Math.round(center.x - NODE_WIDTH / 2), y: Math.round(center.y - 60) });
    occupied.push(position);
    placementSequence += 1;
    await session.dispatch({
      type: "node.move.requested",
      requestId: `playground:place:${placementSequence}`,
      nodeId: node.nodeId,
      layoutSlotRef: layoutSlotRef(node.nodeId),
      x: position.x,
      y: position.y,
    });
  }
}

const NODE_WIDTH = 320;
const NODE_HEIGHT = 260;
const PLACEMENT_STEP = 180;

/** 既存nodeの矩形と重なる間は下へずらす。Host側の便宜であり、canonical layoutではない。 */
export function nextFreeSlot(occupied: readonly { x: number; y: number }[], start: { x: number; y: number }): { x: number; y: number } {
  const candidate = { ...start };
  const overlaps = () => occupied.some((slot) => Math.abs(slot.x - candidate.x) < NODE_WIDTH && Math.abs(slot.y - candidate.y) < NODE_HEIGHT);
  let guard = 0;
  while (overlaps() && guard < 50) { candidate.y += PLACEMENT_STEP; guard += 1; }
  return candidate;
}
