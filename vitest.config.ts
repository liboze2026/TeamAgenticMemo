import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    include: ["packages/*/src/**/__tests__/**/*.test.ts"],
    environment: "node",
    // Windows + pnpm monorepo 下并发 worker 容易 OOM；强制单 thread 顺序跑
    fileParallelism: false,
    pool: "threads",
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    // Xenova 模型首次加载可能需要数秒；给嵌入相关测试留足裕量
    testTimeout: 30000,
  },
});
