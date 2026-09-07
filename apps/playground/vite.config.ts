import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import type { IncomingMessage, ServerResponse } from "node:http";
import { decomposeText, listPlaygroundRoutes, type DecomposeRequest } from "./server/gateway.js";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

function fqueryGateway() {
  return {
    name: "fquery-playground-gateway",
    configureServer(server: { middlewares: { use(handler: (request: IncomingMessage, response: ServerResponse, next: () => void) => void): void } }) {
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
