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
import {
  SqliteWikiRetriever,
  XenovaEmbedder,
  openDb,
  normalizeCwd,
} from "@teamagent/adapters";

const DEFAULT_FREQ = {
  cooldownMinutes: 30,
  sessionWindowMinutes: 60,
  sessionMaxInjections: 15,
} as const;

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
    return; // no DB — silent exit
  }

  const embedder = new XenovaEmbedder();
  const retriever = new SqliteWikiRetriever(db);
  const now = new Date();

  const keywords = extractQueryKeywords(prompt);
  const queryText = buildQueryText(keywords, prompt);
  const embeddings = await embedder.embed([queryText]);
  const embedding = embeddings[0];
  if (!embedding) return;

  const entries = await retriever.query({
    embedding,
    minSimilarity: 0.75,
    maxAgeDays: 90,
    maxResults: 3,
    now,
    ...DEFAULT_FREQ,
  });

  if (entries.length > 0) {
    retriever.recordInjection(
      entries.map((e) => e.knowledgeId),
      now,
    );
  }

  const output = formatInjection(entries);
  if (output) process.stdout.write(output + "\n");
}

main().catch(() => process.exit(0));
