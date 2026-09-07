import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: [{
      find: /^@baklavajs\/core$/,
      replacement: fileURLToPath(new URL("../../node_modules/@baklavajs/core/dist/esm/index.js", import.meta.url)),
    }],
  },
  ssr: { noExternal: ["@baklavajs/core", "@baklavajs/renderer-vue", "@baklavajs/events", "uuid"] },
  build: {
    lib: { entry: "src/index.ts", formats: ["es"], fileName: "fquery-ui" },
    rollupOptions: { external: ["vue", "@fquery/ui-core", "@fquery/fam-edit", "@baklavajs/core", "@baklavajs/renderer-vue"] },
  },
  test: {
    environment: "jsdom",
    server: { deps: { inline: ["@baklavajs/core", "@baklavajs/renderer-vue", "@baklavajs/events", "uuid"] } },
  },
});
