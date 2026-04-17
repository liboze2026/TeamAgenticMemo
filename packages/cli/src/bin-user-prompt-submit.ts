#!/usr/bin/env node
/**
 * UserPromptSubmit Hook entry point (M2.7)
 *
 * stdin JSON { prompt: string }
 * → keyword extract → embed → sqlite-vec query → stdout injection text
 *
 * Any error: exit 0 (never block user input)
 */
import path from "node:path";
import {
  extractQueryKeywords,
  buildQueryText,
  formatInjection,
} from "@teamagent/core";
import { SqliteWikiRetriever } from "@teamagent/adapters/storage/sqlite/sqlite-wiki-retriever";
import { XenovaEmbedder } from "@teamagent/adapters/wiki/xenova-embedder";
import { openDb } from "@teamagent/adapters/storage/sqlite/schema";
import { normalizeCwd } from "@teamagent/adapters/util/normalize-cwd";

const DEFAULT_FREQ = {
  cooldownMinutes: 30,
  sessionWindowMinutes: 60,
  sessionMaxInjections: 15,
} as const;

const HOOK_TIMEOUT_MS = 5_000;

async function runPipeline(db: ReturnType<typeof openDb>, prompt: string): Promise<string | null> {
  const embedder = new XenovaEmbedder();
  const retriever = new SqliteWikiRetriever(db);
  const now = new Date();

  const keywords = extractQueryKeywords(prompt);
  const queryText = buildQueryText(keywords, prompt);
  const embeddings = await embedder.embed([queryText]);
  const embedding = embeddings[0];
  if (!embedding) return null;

  const entries = await retriever.query({
    embedding,
    minSimilarity: 0.75,
    maxAgeDays: 90,
    maxResults: 3,
    now,
    ...DEFAULT_FREQ,
  });

  if (entries.length > 0) {
    retriever.recordInjection(entries.map((e) => e.knowledgeId), now);
  }

  return formatInjection(entries) || null;
}

async function main(): Promise<void> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return;

  const input = JSON.parse(raw) as { prompt?: string };
  const prompt = input.prompt ?? "";
  if (!prompt) return;

  const cwd = normalizeCwd(
    process.env["CLAUDE_PROJECT_DIR"] ?? process.cwd(),
  );
  const dbPath = path.join(cwd, ".teamagent", "knowledge.db");

  let db: ReturnType<typeof openDb>;
  try {
    db = openDb(dbPath);
  } catch {
    return;
  }

  const result = await Promise.race([
    runPipeline(db, prompt),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), HOOK_TIMEOUT_MS)),
  ]);

  if (result) process.stdout.write(result + "\n");
}

main().catch(() => process.exit(0));
