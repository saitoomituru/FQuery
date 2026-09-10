import { act, cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLiteralDecompositionFam } from "@fquery/fam-core";
import { App } from "../src/App.js";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
beforeEach(() => { try { localStorage.clear(); } catch { /* ignore */ } });

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
const fixtureRoutes = [{ provider: "fixture", label: "Fixture", available: true, models: ["mock-fam-transformer"] }];
const fixtureAccessMap = {
  schema_version: "fam.json/0.1.0-draft", fam_id: "fam://fquery/test/basic-commons-access-mapper", revision_id: "rev://fquery/test/basic-commons-access-mapper/2", kind: "access-map", title: "テスト用Basic Commons Access Mapper", title_language: "ja", index_subjects: ["Access Map"],
  ψ: { source_fold_ref: "fold://fquery/test/decomposition", source_registry_ref: "registry://fquery/test/basic-commons@1", accepted_claim_kinds: ["world-fact"] },
  "∇φ": { mapping_rules: [
    { rule_id: "rule://fquery/test/basic-commons/world-fact", source_claim_kind: "world-fact", target_dimension_ref: "dimension://fquery/test/world", claim_scope_ref: "scope://world/fixture-local", evidence_scope: ["fixture-local"] },
    { rule_id: "rule://fquery/test/basic-commons/unknown", source_claim_kind: "unknown", target_dimension_ref: "dimension://fquery/test/unmapped", claim_scope_ref: "scope://unknown", evidence_scope: ["unknown", "not-absence"] },
  ], fact_extractors: [{ extractor_ref: "extractor://fquery/test/issue-35/precipitation-percent", source_unit_order: 0, fact_key: "precipitationProbability", pattern: "降水確率は([0-9]+(?:\\.[0-9]+)?)%", value_type: "number", scope_ref: "scope://fixture/issue-35/tc2-text-adapter" }], causal_gates: [{ gate_ref: "gate://fquery/test/issue-35/rain-anxiety", source_unit_order: 0, fact_path: ["precipitationProbability"], condition_kind: "number-gte", threshold: 38, active_unit_orders: [1, 2], fallback_unit_orders: [], condition_scope_ref: "scope://fixture/issue-35/author-defined-38" }], semantic_topology_contract: { branches_pointer: "/Q/semantic_topology_branches", selected_branch_ref: "branch://fquery/decomposition/primary", selection_scope_ref: "scope://fquery/playground/presentation-only", fields: { branch_ref: "branch_ref", observer_ref: "observer_ref", relations: "relations", from_unit_ref: "from_unit_ref", to_unit_ref: "to_unit_ref", axis: "axis", relation_kind: "relation_kind", evidence_refs: "evidence_refs" } }, loss_declarations: [], source_mutation: false },
  λ: { target_fold_ref: "fold://fquery/test/basic-commons", target_dimension_refs: ["dimension://fquery/test/world", "dimension://fquery/test/unmapped"], output_kind: "classification-binding" },
  Q: { observer_ref: "observer://fquery/test-fixture-author", registry_ref: "registry://fquery/test/basic-commons@1", fact_scope_ref: "world://fquery/test/issue-35", authority_ref: "authority://fquery/test-fixture-only", unknown_policy: "retain", unmapped_policy: "retain-unmapped", fallback_policy: "none", source_mutation: false, unknowns: [], unknown_is_absence: false },
  pointers: [], provenance: { claim_scope: "TEST_FIXTURE", source_refs: ["https://github.com/saitoomituru/FQuery/issues/35"], source_mutation: false },
};
const decompositionResponse = (value: unknown, events: readonly unknown[] = []) => ({ result: { value, transport_status: "succeeded", plugin_status: "resolved", resolution_status: "resolved", connection_status: "connected" }, events, access_map: fixtureAccessMap });
const canvasNodes = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>(".fquery-flow-node")];
const leftPane = (container: HTMLElement) => container.querySelector<HTMLElement>('[aria-label="left pane"]')!;
const rightPane = (container: HTMLElement) => container.querySelector<HTMLElement>('[aria-label="right pane"]')!;
const openLeftTab = (container: HTMLElement, tab: string) => fireEvent.click(leftPane(container).querySelector(`[data-pane-tab="${tab}"]`)!);
const setText = (element: Element, value: string) => fireEvent.change(element, { target: { value } });

async function mountWithGraph(fetcher: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetcher);
  const view = render(<App />);
  await waitFor(() => expect(canvasNodes(view.container)).toHaveLength(3));
  return view;
}

describe("FQuery Playground", () => {
  it("provider Last OrderのcodeとreasonをΨ.NL node内へ表示する", async () => {
    const failed = { result: { schema_version: "fquery.result/0.1.0-draft", query_ref: "q://test/failure", resolution_status: "unknown", connection_status: "connected", transport_status: "succeeded", plugin_status: "resolved", semantic_status: "unknown", lambda_status: "unknown", control_status: "last-order", reason: "invalid-fam-json:source-expression-required", evidence_refs: [], last_order: { code: "FQUERY-PLUGIN-OUTPUT-INVALID", reason: "invalid-fam-json:source-expression-required", requested_next: "inspect-provider-output-or-select-another-route", resume_when: "valid-provider-output-available" } } };
    const fetcher = vi.fn().mockResolvedValueOnce(json(fixtureRoutes)).mockResolvedValueOnce(json(failed));
    const { container } = await mountWithGraph(fetcher);
    await act(async () => { fireEvent.click(canvasNodes(container)[0]!.querySelector('[aria-label="route controls"] button')!); });
    await waitFor(() => expect(container.querySelector(".psi-node-error")?.textContent).toContain("FQUERY-PLUGIN-OUTPUT-INVALID"));
    expect(container.querySelector(".psi-node-error")?.textContent).toContain("source-expression-required");
  });

  it("profile不適合candidateをFAMVIMに保持しcanonical graphやλへは昇格しない", async () => {
    const candidate = { title: "手直し可能な候補", ψ: "入力", "∇φ": [], λ: {}, Q: null, provider_extension: { retained: true } };
    const response = {
      result: {
        candidate,
        transport_status: "succeeded",
        plugin_status: "resolved",
        resolution_status: "resolved",
        connection_status: "connected",
        semantic_status: "not-evaluated",
        lambda_status: "not-evaluated",
        control_status: "last-order",
        reason: "decomposition-profile-nonconformant",
        profile_validation: { baseStructureStatus: "valid", profileConformance: "not-satisfied", issues: [{ path: "$.kind", code: "string-required" }] },
        last_order: { code: "FQUERY-PLUGIN-PROFILE-NONCONFORMANT", reason: "decomposition-profile-nonconformant", requested_next: "inspect-and-edit-candidate-or-select-another-route", resume_when: "profile-conformant-candidate-available" },
      },
    };
    const fetcher = vi.fn().mockResolvedValueOnce(json(fixtureRoutes)).mockResolvedValueOnce(json(response));
    const { container } = await mountWithGraph(fetcher);
    await act(async () => { fireEvent.click(canvasNodes(container)[0]!.querySelector('[aria-label="route controls"] button')!); });
    await waitFor(() => expect(canvasNodes(container)[1]!.textContent).toContain("手直し可能な候補"));
    expect(canvasNodes(container)[1]!.querySelector('[data-axis="semantic"]')?.textContent).toContain("not-satisfied");
    expect(canvasNodes(container)).toHaveLength(3);
    expect(container.querySelector('[data-node-id="q://playground/node/3"]')?.textContent).toContain("未提供");
  });

  it("複数provider/modelを発見し、Ψ.NL node内のdecomposerで分解する", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json([
        ...fixtureRoutes,
        { provider: "gemini", label: "Gemini", available: true, models: ["gemini-2.5-flash-lite"], credentialName: "gemini-local" },
        { provider: "ollama", label: "Ollama Local", available: true, models: ["qwen3:8b", "mistral:7b"] },
      ]))
      .mockResolvedValueOnce(json(decompositionResponse(createLiteralDecompositionFam("自然言語テスト", "q://test/playground"), [{ eventType: "result", status: "result" }])));
    const { container } = await mountWithGraph(fetcher);
    expect(container.textContent).toContain("FQUERY NODE EDITOR");
    const psi = within(canvasNodes(container)[0]!).getByLabelText("route controls");
    await waitFor(() => expect(psi.querySelectorAll("select")[0]?.querySelectorAll("option")).toHaveLength(3));
    setText(psi.querySelectorAll("select")[0]!, "ollama");
    expect((psi.querySelectorAll("select")[1] as HTMLSelectElement).value).toBe("qwen3:8b");
    await act(async () => { fireEvent.click(psi.querySelector("button")!); });
    await waitFor(() => expect(fetcher).toHaveBeenLastCalledWith("/api/decompose", expect.objectContaining({ method: "POST" })));
    openLeftTab(container, "records");
    await waitFor(() => expect(container.querySelector('[data-record-kind="fam"]')?.textContent).toContain("fam.json/0.1.0-draft"));
    expect(container.querySelector('[data-record-kind="fam"]')?.textContent).toContain("ψ");
    expect(container.querySelector('[data-record-kind="famlog"]')?.textContent).toContain("fold.log/0.1.0-alpha");
    expect(container.querySelector('[data-record-kind="famlog"]')?.textContent).toContain("oae.record/0.1.0-alpha");
    expect(container.querySelector('[data-record-kind="famlog"]')?.textContent).toContain("volatile-browser-memory");
    expect(container.querySelector('[data-record-kind="semantic-projection"]')?.textContent).toContain("未生成");
    expect(container.querySelector('[data-record-kind="debug-event"]')?.textContent).toContain("result");
    // recordsは左Tool paneのtabであり、canvasの主表示を奪わない
    expect([...leftPane(container).querySelectorAll('[role="tab"]')].map((tab) => tab.getAttribute("data-pane-tab"))).toEqual(["add", "outline", "records", "decisions"]);
    // outlinerからの選択はsession selectionを通り、canvasのnodeとinspectorに反映される
    openLeftTab(container, "outline");
    fireEvent.click(container.querySelector('[data-node-id="q://playground/node/3"] .fquery-outliner-select')!);
    await waitFor(() => expect(container.querySelector('.fquery-outliner [data-node-id="q://playground/node/3"]')?.getAttribute("data-active")).toBe("true"));
    await waitFor(() => expect(container.querySelector('.fquery-flow-node[data-node-id="q://playground/node/3"]')?.getAttribute("data-selected")).toBe("true"));
    fireEvent.click(container.querySelector('[data-node-id="q://playground/node/3"] .fquery-outliner-focus')!);
  });

  it("pluginなしでCore graphが立ち上がり、分解後はroot FoldへN ∇φを収容する", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json(fixtureRoutes))
      .mockResolvedValueOnce(json(decompositionResponse(createLiteralDecompositionFam("雨が降る。傘を持つ。", "q://test/playground"))));
    const { container } = await mountWithGraph(fetcher);
    const nodes = canvasNodes(container);
    expect(nodes.map((node) => node.getAttribute("data-node-id"))).toEqual(["q://playground/node/1", "q://playground/node/2", "q://playground/node/3"]);
    expect(nodes.every((node) => node.querySelector(".fquery-canvas-node")?.getAttribute("data-presentation-mode") === "native")).toBe(true);
    expect(nodes[0]!.querySelector('[aria-label="route controls"]')).not.toBeNull();
    expect(nodes[1]!.textContent).toContain("canonical FAM未生成");
    expect(nodes[2]!.textContent).toContain("未提供");
    // λ.NLのmanifestationだけがunconnected。unconnected != failure
    const unconnected = [...container.querySelectorAll(".fquery-flow-port[data-connection-status='unconnected']")].map((port) => port.getAttribute("data-port-id"));
    expect(unconnected).toHaveLength(1);
    expect(unconnected[0]).toContain(":manifestation");
    openLeftTab(container, "decisions");
    await waitFor(() => expect(container.querySelectorAll('[data-decision-status="accepted"]')).toHaveLength(8));
    openLeftTab(container, "add");
    expect(container.querySelector('[aria-label="Plugin node palette"]')!.querySelectorAll("li")).toHaveLength(3);
    expect(container.querySelector('[aria-label="Plugin node palette"] [data-category="Core"]')).not.toBeNull();

    await act(async () => { fireEvent.click(canvasNodes(container)[0]!.querySelector('[aria-label="route controls"] button')!); });
    await waitFor(() => expect(canvasNodes(container)[0]!.querySelector('[data-axis="transport"]')?.textContent).toContain("succeeded"));
    expect(canvasNodes(container)[0]!.querySelector('[data-axis="semantic"]')?.textContent).toContain("unknown");
    await waitFor(() => expect(canvasNodes(container)).toHaveLength(4));
    const rootBoundary = container.querySelector('[data-resolution-mode="atomic-resolution"][data-node-id="q://playground/node/2"]')!;
    expect(rootBoundary).not.toBeNull();
    expect(rootBoundary.textContent).toContain("topology");
    expect(rootBoundary.textContent).toContain("G=0/0/0");
    expect([...rootBoundary.querySelectorAll("[data-gate]")]).toHaveLength(4);
    const projected = canvasNodes(container).filter((node) => node.querySelector("[data-fold-ref]"));
    expect(projected).toHaveLength(2);
    expect(projected[0]!.textContent).toContain("雨が降る。");
    expect(projected[0]!.textContent).toContain("dimension://fquery/test/unmapped");
    expect(projected[0]!.textContent).toContain("fam://fquery/test/basic-commons-access-mapper@rev://fquery/test/basic-commons-access-mapper/2");
    const lambdaNode = container.querySelector<HTMLElement>('[data-node-id="q://playground/node/3"]')!;
    await waitFor(() => expect(lambdaNode.textContent).toContain("雨が降る。"));
    expect(lambdaNode.querySelector('[data-axis="lambda"]')?.textContent).toContain("unknown");
    setText(container.querySelector('[aria-label="locale"]')!, "en-US");
    await waitFor(() => expect(projected[0]!.textContent).toContain("Replace selected unit"));

    fireEvent.click(container.querySelector('[aria-label="Plugin node palette"] [data-capability="core.gradient.famvim"]')!);
    await waitFor(() => expect(canvasNodes(container)).toHaveLength(5));
    // 新規nodeはHostがviewport中央へ配置し、layout write-backとしてsessionへ通る
    openLeftTab(container, "decisions");
    await waitFor(() => expect(container.querySelector('[aria-label="session decisions"]')?.textContent).toContain("playground:place:1 → accepted"));
    fireEvent.click(container.querySelector('[title="Frame all (Home)"]')!);
  });
});

describe("FQuery Playground FAMVIM", () => {
  it("選択semantic branchを普遍的正解へ昇格せずFoldLogへscope付き記録する", async () => {
    const fam = structuredClone(createLiteralDecompositionFam("前提である。結論である。", "q://test/playground/branch-receipt"));
    (fam.Q as Record<string, unknown>).semantic_topology_branches = [{
      branch_ref: "branch://fquery/decomposition/primary",
      observer_ref: "observer://test/human-reading",
      relations: [],
    }];
    const fetcher = vi.fn().mockResolvedValueOnce(json(fixtureRoutes)).mockResolvedValueOnce(json(decompositionResponse(fam)));
    const { container } = await mountWithGraph(fetcher);
    await act(async () => { fireEvent.click(canvasNodes(container)[0]!.querySelector('[aria-label="route controls"] button')!); });
    openLeftTab(container, "records");
    await waitFor(() => expect(container.querySelector('[data-record-kind="famlog"]')?.textContent).toContain("branch://fquery/decomposition/primary"));
    expect(container.querySelector('[data-record-kind="famlog"]')?.textContent).toContain('"semanticTopologyStatus": "selected"');
    expect(container.querySelector('[data-record-kind="famlog"]')?.textContent).toContain('"selectionScopeRef": "scope://fquery/playground/presentation-only"');
  });

  it("別文章を続けて分解したとき旧unitを撤去し新revisionだけをλへ投影する", async () => {
    const firstFam = createLiteralDecompositionFam("旧い前提。旧い結論。", "q://test/playground/repeat-first");
    const secondFam = createLiteralDecompositionFam("新しい観測。新しい判断。新しい結論。", "q://test/playground/repeat-second");
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json(fixtureRoutes))
      .mockResolvedValueOnce(json(decompositionResponse(firstFam)))
      .mockResolvedValueOnce(json(decompositionResponse(secondFam)));
    const { container } = await mountWithGraph(fetcher);
    const controls = canvasNodes(container)[0]!.querySelector('[aria-label="route controls"]')!;

    await act(async () => { fireEvent.click(controls.querySelector("button")!); });
    await waitFor(() => expect(container.querySelector('[data-node-id="q://playground/node/3"]')?.textContent).toContain("旧い結論。"));
    expect(canvasNodes(container).filter((node) => node.querySelector('[data-fold-ref^="q://test/playground/repeat-first"]'))).toHaveLength(2);

    setText(controls.querySelector("textarea")!, "新しい観測。新しい判断。新しい結論。");
    await act(async () => { fireEvent.click(controls.querySelector("button")!); });
    await waitFor(() => expect(container.querySelector('[data-node-id="q://playground/node/3"]')?.textContent).toContain("新しい結論。"));
    expect(container.textContent).not.toContain("旧い前提。");
    expect(canvasNodes(container).filter((node) => node.querySelector('[data-fold-ref^="q://test/playground/repeat-first"]'))).toHaveLength(0);
    expect(canvasNodes(container).filter((node) => node.querySelector('[data-fold-ref^="q://test/playground/repeat-second"]'))).toHaveLength(3);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("「なんで？-DeFold-」連打を一実行へ直列化し、処理中表示と同一結果cacheで子node増殖を防ぐ", async () => {
    const parentFam = createLiteralDecompositionFam("前提である。結論である。", "q://test/playground/recursive-chatter-parent");
    const childFam = createLiteralDecompositionFam("理由Aである。理由Bである。", "q://test/playground/recursive-chatter-child");
    let resolveRecursive!: (response: Response) => void;
    const recursiveResponse = new Promise<Response>((resolve) => { resolveRecursive = resolve; });
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json(fixtureRoutes))
      .mockResolvedValueOnce(json(decompositionResponse(parentFam)))
      .mockImplementationOnce(() => recursiveResponse);
    const { container } = await mountWithGraph(fetcher);
    await act(async () => { fireEvent.click(canvasNodes(container)[0]!.querySelector('[aria-label="route controls"] button')!); });
    await waitFor(() => expect(canvasNodes(container)).toHaveLength(4));
    const parentUnit = canvasNodes(container).find((node) => node.querySelector("[data-fold-ref]"))!;
    const why = within(parentUnit).getByText("なんで？-DeFold-") as HTMLButtonElement;
    fireEvent.click(why);
    await waitFor(() => expect(why.disabled).toBe(true));
    expect(why.getAttribute("aria-busy")).toBe("true");
    expect(why.textContent).toBe("DeFold中…");
    fireEvent.click(why);
    expect(fetcher).toHaveBeenCalledTimes(3);
    await act(async () => { resolveRecursive(json(decompositionResponse(childFam))); await recursiveResponse; });
    const boundary = await waitFor(() => {
      const found = container.querySelector<HTMLElement>(`[data-resolution-mode="atomic-resolution"][data-node-id="${parentUnit.getAttribute("data-node-id")}"]`);
      expect(found).not.toBeNull();
      return found!;
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(boundary.getAttribute("data-node-id")).toBe(parentUnit.getAttribute("data-node-id"));
    expect(container.querySelector(`.fquery-flow-node[data-node-id="${parentUnit.getAttribute("data-node-id")}"]`)).toBeNull();
    expect(canvasNodes(container)).toHaveLength(5);
    expect(JSON.parse(String(fetcher.mock.calls[2]?.[1]?.body))).toMatchObject({ source: "前提である。" });
  });

  it("選択unitの「なんで？-DeFold-」を同一IDのFoldへ置換し、親子identityをFoldLogへ残す", async () => {
    const parentFam = createLiteralDecompositionFam("前提である。結論である。", "q://test/playground/recursive-parent");
    const childFam = structuredClone(createLiteralDecompositionFam("理由Aである。理由Bである。", "q://test/playground/recursive-child"));
    (childFam.Q as Record<string, unknown>).semantic_topology_branches = [{
      branch_ref: "branch://fquery/decomposition/primary",
      observer_ref: "observer://test/recursive-reading",
      relations: [],
    }];
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json(fixtureRoutes))
      .mockResolvedValueOnce(json(decompositionResponse(parentFam)))
      .mockResolvedValueOnce(json(decompositionResponse(childFam)));
    const { container } = await mountWithGraph(fetcher);
    await act(async () => { fireEvent.click(canvasNodes(container)[0]!.querySelector('[aria-label="route controls"] button')!); });
    await waitFor(() => expect(canvasNodes(container)).toHaveLength(4));
    const parentUnit = canvasNodes(container).find((node) => node.querySelector("[data-fold-ref]"))!;
    const parentNodeId = parentUnit.getAttribute("data-node-id");
    await act(async () => { fireEvent.click(within(parentUnit).getByText("なんで？-DeFold-")); });
    await waitFor(() => expect(canvasNodes(container)).toHaveLength(5));
    await waitFor(() => expect(container.querySelectorAll('[data-resolution-mode="atomic-resolution"]')).toHaveLength(2));
    const children = canvasNodes(container).filter((node) => node.querySelector('[data-fold-ref^="q://test/playground/recursive-child"]'));
    expect(children).toHaveLength(2);
    const boundary = container.querySelector(`[data-resolution-mode="atomic-resolution"][data-node-id="${parentNodeId}"]`)!;
    expect(boundary.getAttribute("data-node-id")).toBe(parentNodeId);
    expect(container.querySelector(`.fquery-flow-node[data-node-id="${parentNodeId}"]`)).toBeNull();
    expect(boundary.getAttribute("data-dispatch-mode")).toBe("single-processing-unit");
    expect(boundary.textContent).toContain("G=2/2/2 · D=1 · L=0/0/0/not-declared · mL=0/0/0 · child=2 · S=ready");
    expect(boundary.textContent).toContain("まとめる-Fold-");
    expect([...boundary.querySelectorAll("[data-gate]")].map((gate) => gate.getAttribute("data-gate"))).toEqual(["outer-psi", "inner-psi", "inner-lambda", "outer-lambda"]);
    expect([...boundary.querySelectorAll("[data-gate]")].every((gate) => gate.getAttribute("data-connection-status") === "connected")).toBe(true);
    fireEvent.click(within(boundary as HTMLElement).getByText("まとめる-Fold-"));
    await waitFor(() => expect(boundary.getAttribute("data-collapsed")).toBe("true"));
    expect(canvasNodes(container)).toHaveLength(3);
    expect(boundary.textContent).toContain("ひらく-DeFold-");
    fireEvent.click(within(boundary as HTMLElement).getByText("ひらく-DeFold-"));
    await waitFor(() => expect(boundary.getAttribute("data-collapsed")).toBe("false"));
    expect(canvasNodes(container)).toHaveLength(5);
    openLeftTab(container, "outline");
    expect(container.querySelectorAll('.fquery-outliner [data-depth="1"]')).toHaveLength(2);
    expect(container.querySelectorAll('.fquery-outliner [data-depth="2"]')).toHaveLength(2);
    openLeftTab(container, "records");
    expect(container.querySelector('[data-record-kind="famlog"]')?.textContent).toContain('"operation": "recursive-decompose"');
    expect(container.querySelector('[data-record-kind="famlog"]')?.textContent).toContain("q://test/playground/recursive-parent/fam/unit/1");
    expect(container.querySelector('[data-record-kind="famlog"]')?.textContent).toContain("branch://fquery/decomposition/primary");
  });

  it("2段目DeFoldで対象childを同一IDのnested Foldへ置換し外内gateを保持する", async () => {
    const parentFam = createLiteralDecompositionFam("前提である。結論である。", "q://test/playground/nested-parent");
    const childFam = createLiteralDecompositionFam("理由Aである。理由Bである。", "q://test/playground/nested-child");
    const grandchildFam = createLiteralDecompositionFam("根拠である。", "q://test/playground/nested-grandchild");
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json(fixtureRoutes))
      .mockResolvedValueOnce(json(decompositionResponse(parentFam)))
      .mockResolvedValueOnce(json(decompositionResponse(childFam)))
      .mockResolvedValueOnce(json(decompositionResponse(grandchildFam)));
    const { container } = await mountWithGraph(fetcher);
    await act(async () => { fireEvent.click(canvasNodes(container)[0]!.querySelector('[aria-label="route controls"] button')!); });
    await waitFor(() => expect(canvasNodes(container)).toHaveLength(4));
    const parentUnit = canvasNodes(container).find((node) => node.querySelector('[data-fold-ref^="q://test/playground/nested-parent"]'))!;
    await act(async () => { fireEvent.click(within(parentUnit).getByText("なんで？-DeFold-")); });
    const childUnit = await waitFor(() => {
      const found = canvasNodes(container).find((node) => node.textContent?.includes("理由Aである。"));
      expect(found).not.toBeUndefined();
      return found!;
    });
    const childNodeId = childUnit.getAttribute("data-node-id");
    await act(async () => { fireEvent.click(within(childUnit).getByText("なんで？-DeFold-")); });
    await waitFor(() => expect(container.querySelectorAll('[data-resolution-mode="atomic-resolution"]')).toHaveLength(3));
    const nested = container.querySelector(`[data-resolution-mode="atomic-resolution"][data-node-id="${childNodeId}"]`)!;
    expect(nested).not.toBeNull();
    expect(container.querySelector(`.fquery-flow-node[data-node-id="${childNodeId}"]`)).toBeNull();
    expect(nested.textContent).toContain("G=3/3/3");
    expect([...nested.querySelectorAll("[data-gate]")]).toHaveLength(4);
    expect(container.textContent).toContain("根拠である。");
    expect(JSON.parse(String(fetcher.mock.calls[3]?.[1]?.body))).toMatchObject({ source: "理由Aである。" });
  });

  it("TC2の38→0で取消gateを記録し、stale λを出力せず再構成待ちにする", async () => {
    const fam = createLiteralDecompositionFam("降水確率は38%である。不安である。傘を持つ。", "q://test/playground/tc2");
    const fetcher = vi.fn().mockResolvedValueOnce(json(fixtureRoutes)).mockResolvedValueOnce(json(decompositionResponse(fam)));
    const { container } = await mountWithGraph(fetcher);
    await act(async () => { fireEvent.click(canvasNodes(container)[0]!.querySelector('[aria-label="route controls"] button')!); });
    await waitFor(() => expect(canvasNodes(container)).toHaveLength(5));
    const sourceUnit = canvasNodes(container).find((node) => node.querySelector("textarea") && node.textContent?.includes("降水確率は38%"))!;
    setText(sourceUnit.querySelector("textarea")!, "降水確率は0%である。");
    await act(async () => { fireEvent.click(sourceUnit.querySelector("button")!); });
    const lambdaNode = container.querySelector<HTMLElement>('[data-node-id="q://playground/node/3"]')!;
    await waitFor(() => expect(lambdaNode.textContent).toContain("再構成待ち"));
    expect(lambdaNode.textContent).not.toContain("不安である。");
    openLeftTab(container, "records");
    await waitFor(() => expect(container.querySelector('[data-record-kind="famlog"]')?.textContent).toContain('"operation": "validate-edge"'));
    expect(container.querySelector('[data-record-kind="famlog"]')?.textContent).toContain('"projectionStatus": "needs-recomposition"');
    expect(container.querySelector('[data-record-kind="famlog"]')?.textContent).toContain("gate://fquery/test/issue-35/rain-anxiety");
  });

  it("独立∇φ nodeのunit局所差替えで他unitと拡張fieldを保持する", async () => {
    const famWithExtension = { ...createLiteralDecompositionFam("自然言語。テスト。", "q://test/playground"), "x-plugin-extension": { retained: true } };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(json(fixtureRoutes))
      .mockResolvedValueOnce(json(decompositionResponse(famWithExtension)));
    const { container } = await mountWithGraph(fetcher);
    expect(rightPane(container).hasAttribute("hidden")).toBe(true);
    await act(async () => { fireEvent.click(canvasNodes(container)[0]!.querySelector('[aria-label="route controls"] button')!); });
    await waitFor(() => expect(canvasNodes(container)).toHaveLength(4));

    const unitNodes = canvasNodes(container).filter((node) => node.querySelector("[data-fold-ref]"));
    const untouchedText = unitNodes[1]!.textContent;
    const unitEditor = unitNodes[0]!.querySelector("textarea")!;
    expect(unitEditor.classList.contains("nodrag")).toBe(true);
    expect(unitEditor.classList.contains("nopan")).toBe(true);
    expect(unitEditor.classList.contains("nowheel")).toBe(true);
    setText(unitEditor, "差替えた意味単位。");
    const replaceButton = unitNodes[0]!.querySelector("button")!;
    fireEvent.pointerDown(replaceButton);
    await act(async () => { fireEvent.click(replaceButton); });
    await waitFor(() => expect(unitNodes[0]!.textContent).toContain("差替えた意味単位。"));
    await waitFor(() => expect(unitNodes[0]!.querySelector('[data-axis="edit"]')?.textContent).toContain("accepted"));
    expect(unitNodes[1]!.textContent).toBe(untouchedText);
    await waitFor(() => expect(container.querySelector('[data-node-id="q://playground/node/3"]')?.textContent).toContain("差替えた意味単位。"));
    openLeftTab(container, "records");
    expect(container.querySelector('[data-record-kind="fam"]')?.textContent).toContain("x-plugin-extension");
    expect(container.querySelector('[data-record-kind="famlog"]')?.textContent).toContain('"operation": "edit"');
    expect(container.querySelector('[data-record-kind="famlog"]')?.textContent).toContain('"persistenceStatus": "volatile"');
    openLeftTab(container, "decisions");
    expect(container.querySelector('[aria-label="fam edit receipts"]')?.textContent).toContain("accepted");

    fireEvent.click(unitNodes[0]!.querySelectorAll("button")[2]!);
    await waitFor(() => expect(rightPane(container).hasAttribute("hidden")).toBe(false));
    expect(rightPane(container).querySelector('[data-pane-section="decomposer"]')).toBeNull();
    await waitFor(() => expect(rightPane(container).querySelector('[data-pane-tab="raw"]')?.getAttribute("aria-selected")).toBe("true"));
    const panel = container.querySelector('[aria-label="FQuery node panel"]')!;
    expect(panel.getAttribute("data-node-id")).toContain("q://playground/node/");
    expect(panel.getAttribute("data-only")).toBe("raw");
    const famvim = container.querySelector('[aria-label="FAMVIM RAW FAM editor"]')!;
    expect(famvim.querySelector('[data-pointer="/x-plugin-extension/retained"]')).not.toBeNull();
    const textarea = famvim.querySelector("textarea") as HTMLTextAreaElement;
    setText(textarea, textarea.value.replace("\"source-decomposition\"", "\"edited-purpose\""));
    await act(async () => { fireEvent.click(famvim.querySelector("footer button")!); });
    openLeftTab(container, "records");
    await waitFor(() => expect(container.querySelector('[data-record-kind="fam"]')?.textContent).toContain("edited-purpose"));
    expect(container.querySelector('[data-record-kind="fam"]')?.textContent).toContain("x-plugin-extension");
    openLeftTab(container, "decisions");
    expect(container.querySelector('[aria-label="fam edit receipts"]')?.textContent).toContain("accepted");
    expect(container.querySelector('[aria-label="fam edit receipts"]')?.textContent).toContain("rev://playground/fam-edit/2");

    // GUIはinvalid draftもrequestできるが、Coreがrejectしcanonical revisionを変更しない
    const invalidEditor = container.querySelector('[aria-label="FAMVIM RAW FAM editor"] textarea') as HTMLTextAreaElement;
    const invalidFam = JSON.parse(invalidEditor.value) as Record<string, unknown>;
    delete invalidFam.Q;
    setText(invalidEditor, JSON.stringify(invalidFam, null, 2));
    await act(async () => { fireEvent.click(container.querySelector('[aria-label="FAMVIM RAW FAM editor"] footer button')!); });
    openLeftTab(container, "decisions");
    await waitFor(() => expect(container.querySelector('[aria-label="fam edit receipts"]')?.textContent).toContain("rejected"));
    expect(container.querySelector('[aria-label="fam edit receipts"]')?.textContent).toContain("fam-validation-failed");
    openLeftTab(container, "records");
    expect(container.querySelector('[data-record-kind="fam"]')?.textContent).toContain("edited-purpose");

    const famvimAfter = container.querySelector('[aria-label="FAMVIM RAW FAM editor"]')!;
    setText(famvimAfter.querySelector("textarea")!, "{ broken");
    await act(async () => { fireEvent.click(famvimAfter.querySelector("footer button")!); });
    openLeftTab(container, "decisions");
    await waitFor(() => expect(container.querySelector('[aria-label="session decisions"]')?.textContent).toContain("fam-text-unparsed"));
    openLeftTab(container, "records");
    expect(container.querySelector('[data-record-kind="fam"]')?.textContent).toContain("edited-purpose");

    // Ψ.NLのinspectorボタンで対象が切り替わり、設定tabへ戻る。Ψ.NLではHostのdecomposer sectionがstackされる
    fireEvent.click(canvasNodes(container)[0]!.querySelectorAll("button")[1]!);
    await waitFor(() => expect(container.querySelector('[aria-label="FQuery node panel"]')?.getAttribute("data-node-id")).toContain("q://playground/node/1"));
    expect(container.querySelector('[aria-label="FQuery node panel"]')?.textContent).toContain("fquery.core@");
    expect([...rightPane(container).querySelectorAll('[role="tab"]')].map((tab) => tab.getAttribute("data-pane-tab"))).toEqual(["node", "q", "unsupported", "raw"]);
    expect([...rightPane(container).querySelectorAll("[data-pane-section]")].map((section) => section.getAttribute("data-pane-section"))).toEqual(["decomposer", "settings", "connections"]);

    // Unsupported Data → RAWへjumpすると pane tab が切り替わり、FAMVIMで該当pathが選択される
    fireEvent.click(rightPane(container).querySelector('[data-pane-tab="unsupported"]')!);
    fireEvent.click(rightPane(container).querySelector("[data-jump]")!);
    await waitFor(() => expect(rightPane(container).querySelector('[data-pane-tab="raw"]')?.getAttribute("aria-selected")).toBe("true"));
    await waitFor(() => expect(rightPane(container).querySelector('[aria-current="true"][data-pointer]')).not.toBeNull());

    // T / N で左右paneを開閉。入力中は無効
    fireEvent.keyDown(container.querySelector(".shell")!, { key: "n" });
    expect(rightPane(container).hasAttribute("hidden")).toBe(true);
    fireEvent.keyDown(container.querySelector(".shell")!, { key: "t" });
    expect(leftPane(container).hasAttribute("hidden")).toBe(true);
    fireEvent.keyDown(container.querySelector(".shell textarea")!, { key: "t" });
    expect(leftPane(container).hasAttribute("hidden")).toBe(true);
  });

  it("降水確率の局所差替えをcommit後にλとFoldLog edit recordへ自動反映する", async () => {
    const fam = structuredClone(createLiteralDecompositionFam("雨が降っている。傘を持って出かける。ただし降水量は未確認である。", "q://test/playground/precipitation-edit"));
    const targetUnit = (fam.λ as { output_units: Array<Record<string, unknown>> }).output_units[2]!;
    const targetRef = (targetUnit.Q as { unit_ref: string }).unit_ref;
    (targetUnit.λ as { sub_splitters: unknown[] }).sub_splitters.push({
      ψ: { source_text: "ただし降水量は未確認である。", source_language: "ja", target_language: "en" },
      "∇φ": [{ gradient_type: "translation-copy" }],
      λ: { manifestation: "However, the amount of precipitation is unconfirmed.", manifestation_language: "en" },
      Q: { copy_role: "translation-witness", source_node_ref: targetRef, unknowns: [], unknown_is_absence: false, translation_error: { status: "not-evaluated", metric_refs: [], measurements: [] } },
    });
    const fetcher = vi.fn().mockResolvedValueOnce(json(fixtureRoutes)).mockResolvedValueOnce(json(decompositionResponse(fam)));
    const { container } = await mountWithGraph(fetcher);
    await act(async () => { fireEvent.click(canvasNodes(container)[0]!.querySelector('[aria-label="route controls"] button')!); });
    await waitFor(() => expect(canvasNodes(container)).toHaveLength(5));
    const target = canvasNodes(container).filter((node) => node.querySelector("[data-fold-ref]")).find((node) => node.textContent?.includes("ただし降水量は未確認である。"))!;
    setText(target.querySelector("textarea")!, "ただし降水確率68パーセントである");
    await act(async () => { fireEvent.click(target.querySelector("button")!); });
    const lambda = container.querySelector<HTMLElement>('[data-node-id="q://playground/node/3"]')!;
    await waitFor(() => expect(lambda.textContent).toContain("ただし降水確率68パーセントである"));
    openLeftTab(container, "records");
    await waitFor(() => expect(container.querySelector('[data-record-kind="famlog"]')?.textContent).toContain('"operation": "edit"'));
    expect(container.querySelector('[data-record-kind="famlog"]')?.textContent).toContain('"resultRevisionRef": "rev://playground/fam-edit/1"');
    expect(container.querySelector('[data-record-kind="famlog"]')?.textContent).toContain('"invalidatedDerivedPaths": [');
    expect(container.querySelector('[data-record-kind="famlog"]')?.textContent).toContain('"/λ/sub_splitters"');
  });
});

describe("Core graph構築の冪等性", () => {
  it("StrictModeの二重effectでもCore 3 nodeが二重に構築されない", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(fixtureRoutes)));
    const { container } = render(<StrictMode><App /></StrictMode>);
    await waitFor(() => expect(canvasNodes(container).length).toBeGreaterThanOrEqual(3));
    openLeftTab(container, "decisions");
    await waitFor(() => expect(container.querySelectorAll('[data-decision-status="accepted"]').length).toBeGreaterThanOrEqual(8));
    expect(canvasNodes(container)).toHaveLength(3);
  });
});

describe("nextFreeSlot", () => {
  it("既存nodeと重なる位置は下へずらす", async () => {
    const { nextFreeSlot } = await import("../src/host/core-graph.js");
    expect(nextFreeSlot([{ x: 420, y: 80 }], { x: 400, y: 100 })).toEqual({ x: 400, y: 460 });
    expect(nextFreeSlot([{ x: 0, y: 0 }], { x: 800, y: 100 })).toEqual({ x: 800, y: 100 });
  });
});
