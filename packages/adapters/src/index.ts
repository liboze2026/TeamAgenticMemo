// v2 SQLite stores
export { SqliteKnowledgeStore } from "./storage/sqlite/sqlite-knowledge-store.js";
export { SqliteEventLog } from "./storage/sqlite/sqlite-event-log.js";
export { SqliteObservations, type Observation } from "./storage/sqlite/sqlite-observations.js";
export { DualLayerStore, type DualLayerStoreConfig } from "./storage/sqlite/dual-layer-store.js";
export { openDb, closeDb, INIT_SQL, CURRENT_SCHEMA_VERSION } from "./storage/sqlite/schema.js";

// v2 SDK hooks
export {
  createPreToolUseHandler,
  type PreToolUseDeps,
  type PreToolUseResult,
} from "./hook/claude-agent-sdk/pre-tool-use-sdk.js";
export {
  createPostToolUseHandler,
  type PostToolUseDeps,
} from "./hook/claude-agent-sdk/post-tool-use-sdk.js";

// util
export { normalizeCwd } from "./util/normalize-cwd.js";

export { InMemoryKnowledgeStore } from "./storage/in-memory-store.js";
export { InMemoryAttributionBus } from "./attribution/in-memory-bus.js";
export { StdoutRenderer } from "./attribution/stdout-renderer.js";
export {
  MarkdownCompiler,
  type CompileWriteInfo,
} from "./compiler/markdown-compiler.js";
export {
  ClaudeSessionSource,
  parseSessionFile,
} from "./session-source/claude-session-source.js";
export {
  ClaudeCodeLLMClient,
  parseClaudeJsonOutput,
  type ClaudeCodeLLMClientOptions,
  type Spawner,
  type SpawnResult,
} from "./llm/claude-code-client.js";
export { makeSkillCompiler } from "./compiler/skill-compiler.js";
export {
  ClaudePluginInstaller,
  type PluginCmdSpawner,
  type PluginCmdResult,
  type PluginInstallerOptions,
  type InstallPluginOptions,
  type StepOutcome,
} from "./plugins/claude-plugin-installer.js";
export type { SkillCompilerOptions } from "./compiler/skill-compiler.js";
export { SqliteCandidateQueue } from "./storage/sqlite/sqlite-candidate-queue.js";
export { CompositeErrorSignalCollector } from "./error-collector/composite-error-signal-collector.js";
export { HaikuJudge, buildJudgePrompt, parseJudgeResponse } from "./wiki/haiku-judge.js";
export { XenovaEmbedder } from "./wiki/xenova-embedder.js";
export { WikiPipeline, type PipelineOptions, type PipelineReport } from "./wiki/wiki-pipeline.js";
export { WikiStore } from "./storage/sqlite/wiki-store.js";
export { WikiSubscriptionStore } from "./wiki/wiki-subscription-store.js";
export { SqliteWikiRetriever } from "./storage/sqlite/sqlite-wiki-retriever.js";
export { ArchiveSweeper } from "./wiki/archive-sweeper.js";
export type { SweepReport, SweeperOptions } from "./wiki/archive-sweeper.js";
export { LastPullMarker } from "./wiki/last-pull-marker.js";
export type { LastPullRecord } from "./wiki/last-pull-marker.js";
export { loadWikiConfig, DEFAULT_WIKI_CONFIG } from "./wiki/config-loader.js";
export type { WikiConfig } from "./wiki/config-loader.js";
