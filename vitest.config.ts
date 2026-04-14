import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    include: ["packages/*/src/**/__tests__/**/*.test.ts"],
    environment: "node",
    // Windows + pnpm monorepo 下 worker 并发容易 OOM；强制顺序跑。
    fileParallelism: false,
  },
});
