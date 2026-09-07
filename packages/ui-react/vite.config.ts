import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    lib: { entry: "src/index.ts", formats: ["es"], fileName: "fquery-ui-react" },
    rollupOptions: { external: ["react", "react-dom", "react/jsx-runtime", "@fquery/ui-core", "@xyflow/react"] },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
  },
});
