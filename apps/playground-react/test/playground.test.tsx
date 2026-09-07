import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App.js";

afterEach(cleanup);
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.endsWith("/api/routes")) return new Response(JSON.stringify([{ provider: "fixture", label: "Fixture", available: true, models: ["mock-fam-transformer"] }]), { status: 200, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify({ error: "not-stubbed" }), { status: 502 });
  }));
});

describe("Playground (React)", () => {
  it("pluginなしでCore 3 nodeと2本の接続がacceptedとして並ぶ", async () => {
    const { container } = render(<App />);
    await waitFor(() => expect(container.querySelectorAll(".fquery-flow-node")).toHaveLength(3));
    await waitFor(() => expect(container.querySelectorAll(".decision-list li[data-status='accepted']").length).toBeGreaterThanOrEqual(8));
    const labels = [...container.querySelectorAll(".fquery-flow-node-title")].map((node) => node.textContent);
    expect(labels).toEqual(["Ψ.NL", "∇φ.FAMVIM", "λ.NL"]);
    // λ.NLのmanifestationだけがunconnected。unconnected != failure
    const unconnected = [...container.querySelectorAll(".fquery-flow-port[data-connection-status='unconnected']")].map((port) => port.getAttribute("data-port-id"));
    expect(unconnected).toHaveLength(1);
    expect(unconnected[0]).toContain(":manifestation");
    expect(container.querySelector(".psi-node textarea")).not.toBeNull();
  });
});

describe("nextFreeSlot", () => {
  it("既存nodeと重なる位置は下へずらす", async () => {
    const { nextFreeSlot } = await import("../src/host/core-graph.js");
    expect(nextFreeSlot([{ x: 420, y: 80 }], { x: 400, y: 100 })).toEqual({ x: 400, y: 460 });
    expect(nextFreeSlot([{ x: 0, y: 0 }], { x: 800, y: 100 })).toEqual({ x: 800, y: 100 });
  });
});
