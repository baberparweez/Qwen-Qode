import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/**/*.test.ts"],
    coverage: {
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/tests/**", "src/index.ts"],
    },
  },
});
