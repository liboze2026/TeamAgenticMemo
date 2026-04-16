import type { WikiSourceConfig } from "@teamagent/ports";

// AI/ML packages that trigger arxiv subscription
const AI_PACKAGES = new Set([
  "@anthropic-ai/sdk", "anthropic", "openai", "@openai/api",
  "langchain", "@langchain/core", "transformers", "torch",
  "tensorflow", "keras", "huggingface_hub",
]);

// Node/TS packages (~30) + AI packages (~10) + general tools (~10)
export const STACK_TO_SOURCES: Record<string, WikiSourceConfig[]> = {
  // JS/TS core
  "typescript":   [{ type: "github_release", repo: "microsoft/TypeScript" }],
  "react":        [{ type: "github_release", repo: "facebook/react" },
                   { type: "rss", url: "https://react.dev/blog/rss.xml" }],
  "vue":          [{ type: "github_release", repo: "vuejs/core" }],
  "svelte":       [{ type: "github_release", repo: "sveltejs/svelte" }],
  "next":         [{ type: "github_release", repo: "vercel/next.js" }],
  "nuxt":         [{ type: "github_release", repo: "nuxt/nuxt" }],
  "vite":         [{ type: "github_release", repo: "vitejs/vite" }],
  "vitest":       [{ type: "github_release", repo: "vitest-dev/vitest" }],
  "eslint":       [{ type: "github_release", repo: "eslint/eslint" },
                   { type: "npm", package: "eslint" }],
  "prettier":     [{ type: "github_release", repo: "prettier/prettier" }],
  "axios":        [{ type: "github_release", repo: "axios/axios" },
                   { type: "npm", package: "axios" }],
  "zod":          [{ type: "github_release", repo: "colinhacks/zod" }],
  "express":      [{ type: "github_release", repo: "expressjs/express" }],
  "fastify":      [{ type: "github_release", repo: "fastify/fastify" }],
  "prisma":       [{ type: "github_release", repo: "prisma/prisma" }],
  "drizzle-orm":  [{ type: "github_release", repo: "drizzle-team/drizzle-orm" }],
  "tailwindcss":  [{ type: "github_release", repo: "tailwindlabs/tailwindcss" }],
  "pnpm":         [{ type: "github_release", repo: "pnpm/pnpm" }],
  "tsx":          [{ type: "github_release", repo: "privatenumber/tsx" }],
  "esbuild":      [{ type: "github_release", repo: "evanw/esbuild" }],
  "tsup":         [{ type: "github_release", repo: "egoist/tsup" }],
  "commander":    [{ type: "github_release", repo: "tj/commander.js" }],
  "chalk":        [{ type: "npm", package: "chalk" }],
  "dotenv":       [{ type: "npm", package: "dotenv" }],
  "date-fns":     [{ type: "github_release", repo: "date-fns/date-fns" }],
  "lodash":       [{ type: "npm", package: "lodash" }],
  "mitt":         [{ type: "github_release", repo: "developit/mitt" }],
  "better-sqlite3": [{ type: "npm", package: "better-sqlite3" }],
  // AI/ML
  "@anthropic-ai/sdk": [{ type: "github_release", repo: "anthropics/anthropic-sdk-python" },
                         { type: "rss", url: "https://www.anthropic.com/news/rss.xml" }],
  "anthropic":    [{ type: "github_release", repo: "anthropics/anthropic-sdk-python" },
                   { type: "rss", url: "https://www.anthropic.com/news/rss.xml" }],
  "@anthropic-ai/claude-agent-sdk": [{ type: "github_release", repo: "anthropics/claude-code" }],
  "openai":       [{ type: "github_release", repo: "openai/openai-node" }],
  "langchain":    [{ type: "github_release", repo: "langchain-ai/langchain" }],
  "@langchain/core": [{ type: "github_release", repo: "langchain-ai/langchainjs" }],
  // General tools
  "docker":       [{ type: "rss", url: "https://www.docker.com/blog/feed/" }],
  "github-actions": [{ type: "github_release", repo: "actions/toolkit" }],
  "node":         [{ type: "github_release", repo: "nodejs/node" }],
};

const ARXIV_SOURCES: WikiSourceConfig[] = [
  { type: "arxiv", category: "cs.AI" },
  { type: "arxiv", category: "cs.LG" },
];

export function autoSubscribe(stack: string[]): WikiSourceConfig[] {
  const sources: WikiSourceConfig[] = [];
  const seen = new Set<string>();
  let needsArxiv = false;

  for (const pkg of stack) {
    const configs = STACK_TO_SOURCES[pkg];
    if (configs) {
      for (const config of configs) {
        const key = JSON.stringify(config);
        if (!seen.has(key)) {
          seen.add(key);
          sources.push(config);
        }
      }
    }
    if (AI_PACKAGES.has(pkg)) needsArxiv = true;
  }

  if (needsArxiv) {
    for (const config of ARXIV_SOURCES) {
      const key = JSON.stringify(config);
      if (!seen.has(key)) {
        seen.add(key);
        sources.push(config);
      }
    }
  }

  return sources;
}
