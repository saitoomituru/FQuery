import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { decomposeText, listPlaygroundRoutes, type DecomposeRequest } from "./server/gateway.js";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const backendRuntimeEntries = [
  "packages/config/dist/index.js",
  "packages/core/dist/index.js",
  "packages/fam-core/dist/index.js",
  "packages/plugin-sdk/dist/index.js",
  "plugins/gemini/dist/index.js",
  "plugins/ollama/dist/index.js",
].map((path) => resolve(repoRoot, path));

function fqueryGateway() {
  return {
    name: "fquery-playground-gateway",
    configureServer(server: ViteDevServer) {
      watchBackendRuntime(server);
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
        if (request.method === "GET" && pathname === "/api/routes") {
          void listPlaygroundRoutes({ repoRoot }).then((value) => sendJson(response, 200, value), (error) => sendError(response, error));
          return;
        }
        if (request.method === "POST" && pathname === "/api/decompose") {
          void readJson(request).then((value) => decomposeText(value as DecomposeRequest, { repoRoot })).then((value) => sendJson(response, 200, value), (error) => sendError(response, error));
          return;
        }
        next();
      });
    },
  };
}

/** browser HMRだけが新しくgatewayのprovider moduleだけが旧版になるsplit-brainを防ぐ。 */
function watchBackendRuntime(server: ViteDevServer): void {
  let restartTimer: ReturnType<typeof setTimeout> | undefined;
  server.watcher.add(backendRuntimeEntries);
  server.watcher.on("change", (path) => {
    if (!backendRuntimeEntries.includes(resolve(path))) return;
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(() => void server.restart(), 100);
  });
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new TypeError("request-too-large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
}

function sendError(response: ServerResponse, error: unknown): void {
  sendJson(response, error instanceof TypeError ? 400 : 502, { error: error instanceof Error ? error.message : "gateway-failed" });
}

export default defineConfig({
  plugins: [react(), fqueryGateway()],
  server: { host: "127.0.0.1", port: 3000, strictPort: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
  },
});
