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
import os from "node:os";
import {
  extractQueryKeywords,
  buildQueryText,
  formatInjection,
} from "@teamagent/core";
import { SqliteWikiRetriever } from "@teamagent/adapters/storage/sqlite/sqlite-wiki-retriever";
import { XenovaEmbedder } from "@teamagent/adapters/wiki/xenova-embedder";
import { openDb } from "@teamagent/adapters/storage/sqlite/schema";
import { normalizeCwd } from "@teamagent/adapters/util/normalize-cwd";
import {
  DualLayerStore,
  SqliteEventLog,
} from "@teamagent/adapters";
import {
  buildInjectionFromPending,
  persistLastInjected,
  scanUserInput,
  formatUserInputFlag,
} from "./user-prompt-inject.js";
import {
  retrieveRulesForPrompt,
} from "./user-prompt-rule-retriever.js";
import {
  isFirstPrompt,
  appendSessionInjected,
  readSessionInjected,
  touchSessionInjected,
} from "./session-rule-injected.js";

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

  const input = JSON.parse(raw) as { prompt?: string; session_id?: string };
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

  const blocks: string[] = [];

  // M4-A: narrative warnings + user-input flag (fast path, runs first)
  try {
    const sessionId = input.session_id ?? "";
    if (sessionId) {
      const sessionsDir = path.join(os.homedir(), ".teamagent", "sessions");
      const { text: injText, injectedIds } = buildInjectionFromPending({
        sessionsDir,
        sessionId,
      });
      if (injText) blocks.push(injText);

      // user-input channel scan — use store to read rules
      const globalDbPath = path.join(os.homedir(), ".teamagent", "global.db");
      const store = new DualLayerStore({ projectDbPath: dbPath, userGlobalDbPath: globalDbPath });
      const rules = store.findActive();
      const userHits = scanUserInput(prompt, rules);
      const flagText = formatUserInputFlag(userHits);
      if (flagText) blocks.push(flagText);
      store.close();

      // Persist injected ids for next Stop to classify recurrence/compliance
      persistLastInjected(sessionsDir, sessionId, injectedIds);

      // Emit events
      if (injectedIds.length > 0 || userHits.length > 0) {
        const eventsDbPath = path.join(os.homedir(), ".teamagent", "events.db");
        const eventLog = new SqliteEventLog(openDb(eventsDbPath));
        const now = new Date().toISOString();
        // Base time + short random suffix: prevents millisecond collisions when
        // the hook re-fires rapidly (harness retry, parallel agents, etc).
        const stamp = () =>
          `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        if (injectedIds.length > 0) {
          eventLog.append({
            id: `e-inject-${sessionId}-${stamp()}`,
            kind: "ai.narrative.injected",
            knowledge_ids: injectedIds,
            session_id: sessionId,
            timestamp: now,
            schema_version: 1,
          });
        }
        for (const h of userHits) {
          eventLog.append({
            id: `e-uflag-${sessionId}-${h.knowledge_id}-${stamp()}`,
            kind: "ai.user_input.flagged",
            knowledge_id: h.knowledge_id,
            session_id: sessionId,
            timestamp: now,
            schema_version: 1,
          });
        }
        eventLog.close();
      }
    }
  } catch {
    // M4-A injection is best-effort — never block user input
  }

  // Rule semantic retrieval (Tier-1 / Tier-2)
  try {
    const sessionId = input.session_id ?? "";
    if (sessionId && prompt) {
      const sessionsDir = path.join(os.homedir(), ".teamagent", "sessions");
      const globalDbPath = path.join(os.homedir(), ".teamagent", "global.db");
      const firstPrompt = isFirstPrompt(sessionsDir, sessionId);
      const seenIds = readSessionInjected(sessionsDir, sessionId);

      const ruleResult = await Promise.race([
        retrieveRulesForPrompt({
          userMessage: prompt,
          cwd,
          projectDbPath: dbPath,
          globalDbPath,
          sessionSeenIds: seenIds,
          isFirstPrompt: firstPrompt,
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), HOOK_TIMEOUT_MS)),
      ]);

      if (ruleResult) {
        if (ruleResult.injectionText) {
          blocks.push(ruleResult.injectionText);
        }
        if (ruleResult.allInjectedIds.length > 0) {
          appendSessionInjected(sessionsDir, sessionId, ruleResult.allInjectedIds);
        } else if (firstPrompt) {
          // Even when no rules were found on the first prompt, touch the session
          // file so Tier-1 doesn't re-trigger on subsequent prompts.
          touchSessionInjected(sessionsDir, sessionId);
        }
      }
    }
  } catch {
    // rule retrieval is best-effort — never block user input
  }

  // Wiki injection (original M2.7 path)
  const result = await Promise.race([
    runPipeline(db, prompt),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), HOOK_TIMEOUT_MS)),
  ]);

  if (result) blocks.push(result);

  if (blocks.length > 0) process.stdout.write(blocks.join("\n\n") + "\n");
}

main().catch(() => process.exit(0));
