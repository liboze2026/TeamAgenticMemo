import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    include: ["packages/*/src/**/__tests__/**/*.test.ts"],
    environment: "node",
  },
});
