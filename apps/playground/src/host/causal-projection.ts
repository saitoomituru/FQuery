import { reprojectFoldGraph, type FoldProjectionNode, type FoldReprojectionResult } from "@fquery/core";
import { projectDecompositionUnits, type AccessMapProfile, type FamJsonRecord } from "@fquery/fam-core";

/**
 * Access Mapper FAMに明示されたfixture-local extractor/gateだけをCore evaluatorへ適合する。
 * 規則または一致が無い本文から、因果・数値fact・fallbackを推論しない。
 */
export function reprojectWithAccessMap(
  fam: FamJsonRecord,
  accessMap: AccessMapProfile,
  changedFoldRefs: readonly string[] = [],
): FoldReprojectionResult | undefined {
  const units = projectDecompositionUnits(fam, accessMap);
  const factsByOrder = new Map<number, Record<string, unknown>>();
  for (const extractor of accessMap.factExtractors) {
    const unit = units[extractor.sourceUnitOrder];
    if (!unit) throw new TypeError(`access-map-extractor-unit-order-not-found:${extractor.sourceUnitOrder}`);
    const match = new RegExp(extractor.pattern, "u").exec(manifestationOf(unit.value));
    if (!match?.[1]) continue;
    const numeric = Number(match[1]);
    if (!Number.isFinite(numeric)) continue;
    const facts = factsByOrder.get(extractor.sourceUnitOrder) ?? {};
    facts[extractor.factKey] = numeric;
    factsByOrder.set(extractor.sourceUnitOrder, facts);
  }
  const applicableGates = accessMap.causalGates.filter((gate) => factsByOrder.has(gate.sourceUnitOrder));
  if (applicableGates.length === 0) return undefined;
  const gateByActiveOrder = new Map<number, { gateRef: string; role: "active" | "fallback" }>();
  for (const gate of applicableGates) {
    for (const order of gate.activeUnitOrders) gateByActiveOrder.set(order, { gateRef: gate.gateRef, role: "active" });
    for (const order of gate.fallbackUnitOrders) gateByActiveOrder.set(order, { gateRef: gate.gateRef, role: "fallback" });
  }
  const nodeRef = (order: number) => {
    const unit = units[order];
    if (!unit) throw new TypeError(`access-map-gate-unit-order-not-found:${order}`);
    return unit.unitRef;
  };
  return reprojectFoldGraph({
    nodes: units.map((unit): FoldProjectionNode => {
      const facts = factsByOrder.get(unit.order);
      const branch = gateByActiveOrder.get(unit.order);
      return {
        foldRef: unit.unitRef,
        order: unit.order,
        manifestation: manifestationOf(unit.value),
        ...(facts ? { facts } : {}),
        ...(branch ? { branch } : {}),
      };
    }),
    dependencies: [],
    gates: applicableGates.map((gate) => ({
      gateRef: gate.gateRef,
      sourceFoldRef: nodeRef(gate.sourceUnitOrder),
      condition: { kind: gate.conditionKind, path: gate.factPath, threshold: gate.threshold },
      activeFoldRefs: gate.activeUnitOrders.map(nodeRef),
      fallbackFoldRefs: gate.fallbackUnitOrders.map(nodeRef),
      conditionScopeRef: gate.conditionScopeRef,
    })),
    changedFoldRefs,
  });
}

function manifestationOf(unit: Readonly<Record<string, unknown>>): string {
  const lambda = unit.λ;
  return lambda && typeof lambda === "object" && !Array.isArray(lambda) && typeof (lambda as Record<string, unknown>).manifestation === "string"
    ? String((lambda as Record<string, unknown>).manifestation)
    : "";
}
