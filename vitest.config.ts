import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    coverage: {
      reporter: ["text", "lcov"]
    }
  }
});

