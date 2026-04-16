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
export { JsonlKnowledgeStore } from "./storage/jsonl-store.js";
export { InMemoryAttributionBus } from "./attribution/in-memory-bus.js";
export { StdoutRenderer } from "./attribution/stdout-renderer.js";
export {
  MarkdownCompiler,
  type CompileWriteInfo,
} from "./compiler/markdown-compiler.js";
export { JsonlEventLog } from "./events/jsonl-event-log.js";
export {
  handlePreToolUse,
  type PreToolUseOptions,
} from "./hook/pre-tool-use.js";
export {
  handlePostToolUse,
  inferToolSuccess,
  type PostToolUseOptions,
} from "./hook/post-tool-use.js";
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
