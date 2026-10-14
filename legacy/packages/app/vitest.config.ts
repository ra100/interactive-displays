import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.{test,integration.test}.{ts,tsx}"],
    coverage: {
      reporter: ["text", "html"],
      exclude: ["node_modules/", "src/test-setup.ts"],
    },
  },
  resolve: {
    alias: {
      "@interactive-displays/shared": resolve(__dirname, "../shared/src"),
    },
  },
});
