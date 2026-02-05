import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    include: ["src/**/*.{test,integration.test}.ts"],
    coverage: {
      reporter: ["text", "html"],
      exclude: ["node_modules/"],
    },
  },
  resolve: {
    alias: {
      "@interactive-displays/shared": resolve(__dirname, "../shared/src"),
    },
  },
});
