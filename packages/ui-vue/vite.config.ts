import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: { entry: "src/index.ts", formats: ["es"], fileName: "fquery-ui" },
    rollupOptions: { external: ["vue", "@fquery/ui-core"] },
  },
  test: { environment: "jsdom" },
});
