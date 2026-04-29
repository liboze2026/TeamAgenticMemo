import {
  buildFallbackDescriptions
} from "./chunk-XG7FTPKD.js";
import {
  InMemoryAttributionBus,
  MarkdownCompiler,
  StdoutRenderer,
  XenovaRuleEmbedder,
  makeSkillCompiler
} from "./chunk-NAWUQDTY.js";
import {
  DualLayerStore,
  syncRuleVectors,
  syncToolVector
} from "./chunk-KGB2IXNQ.js";
import {
  openDb
} from "./chunk-UQ5KOJUO.js";
import {
  runCompile
} from "./chunk-VASCS3RI.js";
import {
  computeEnforcement,
  parseVisibilityMode
} from "./chunk-4EBMEK5Z.js";
import {
  init_esm_shims
} from "./chunk-ZWU7KJPP.js";

// ../cli/src/commands/pitfall.ts
init_esm_shims();
import os from "os";
import path from "path";
import fs from "fs";
function resolvePaths(opts) {
  const home = opts.homeDir ?? os.homedir();
  const cwd = opts.cwd ?? process.cwd();
  return {
    projectDbPath: opts.projectDbPath ?? path.join(cwd, ".teamagent", "knowledge.db"),
    userGlobalDbPath: opts.userGlobalDbPath ?? path.join(home, ".teamagent", "global.db"),
    claudeMdPath: opts.claudeMdPath ?? path.join(cwd, "CLAUDE.md")
  };
}
function generateId(level, ts) {
  const prefix = level === "personal" || level === "team" ? "pers" : "glob";
  const short = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${ts.replace(/[-:T.Z]/g, "").slice(0, 14)}-${short}`;
}
function buildEntry(input, now) {
  const rawLevel = input.level ?? "personal";
  const level = rawLevel === "global" ? "global" : "personal";
  const nature = input.nature ?? "subjective";
  const confidence = 0.7;
  const enforcement = computeEnforcement(confidence, nature);
  const category = input.category ?? "E";
  const tags = input.tags && input.tags.length > 0 ? input.tags : [category.toLowerCase()];
  return {
    id: generateId(rawLevel, now),
    scope: {
      level,
      ...input.project ? { project: input.project } : {}
    },
    category,
    tags,
    type: input.wrong.trim() === "" ? "practice" : "avoidance",
    nature,
    trigger: input.trigger,
    wrong_pattern: input.wrong,
    correct_pattern: input.correct,
    reasoning: input.reason,
    confidence,
    enforcement,
    status: "active",
    hit_count: 0,
    success_count: 0,
    override_count: 0,
    evidence: { success_sessions: 0, success_users: 0, correction_sessions: 0 },
    created_at: now,
    last_hit_at: "",
    last_validated_at: now,
    source: "accumulated",
    conflict_with: [],
    current_tier: "canonical",
    max_tier_ever: "canonical",
    tier_entered_at: "",
    demerit: 0,
    demerit_last_updated: "",
    resurrect_count: 0
  };
}
async function executePitfall(input, opts = {}) {
  const paths = resolvePaths(opts);
  const now = (opts.now ?? (() => (/* @__PURE__ */ new Date()).toISOString()))();
  const env = opts.env ?? process.env;
  const mode = parseVisibilityMode(env.TEAMAGENT_VISIBILITY);
  fs.mkdirSync(path.dirname(paths.projectDbPath), { recursive: true });
  fs.mkdirSync(path.dirname(paths.userGlobalDbPath), { recursive: true });
  const store = new DualLayerStore({
    projectDbPath: paths.projectDbPath,
    userGlobalDbPath: paths.userGlobalDbPath
  });
  const before = store.getAll().length;
  const entry = buildEntry(input, now);
  store.add(entry);
  const compileResult = await runCompile({
    store,
    markdownCompiler: new MarkdownCompiler(paths.claudeMdPath, () => now),
    skillCompiler: makeSkillCompiler()
  });
  const after = store.getAll().length;
  store.close();
  try {
    const desc = buildFallbackDescriptions({
      trigger: entry.trigger,
      wrong_pattern: entry.wrong_pattern,
      correct_pattern: entry.correct_pattern,
      reasoning: entry.reasoning
    });
    const embedder = opts.embedder ?? new XenovaRuleEmbedder();
    const [tv, pv] = await embedder.embed([desc.trigger_description, desc.pattern_description]);
    if (tv && pv) {
      const vdb = openDb(paths.projectDbPath);
      vdb.prepare(
        "UPDATE knowledge SET trigger_description=?, pattern_description=?, embedder_model_id=? WHERE id=?"
      ).run(desc.trigger_description, desc.pattern_description, "Xenova/multilingual-e5-small", entry.id);
      syncRuleVectors(vdb, entry.id, new Float32Array(tv), new Float32Array(pv));
      vdb.close();
    }
  } catch {
  }
  if (!opts.embedder && process.env.VITEST !== "true" && env.TEAMAGENT_DISABLE_TOOL_CONTEXT !== "1") {
    generateToolContextAsync(entry, paths.projectDbPath).catch(() => {
    });
  }
  const home = opts.homeDir ?? os.homedir();
  const skillMdPath = path.join(home, ".claude", "skills", "teamagent", entry.id, "SKILL.md");
  const target = entry.type === "practice" ? { file: skillMdPath } : { file: compileResult.markdown.path, count: compileResult.markdown.blockLineCount };
  const bus = new InMemoryAttributionBus();
  bus.emit({
    source: "pitfall",
    action: `\u6DFB\u52A0\u77E5\u8BC6\u6761\u76EE ${entry.id} (${entry.category}/${entry.tags[0]})`,
    severity: "highlight",
    timestamp: now,
    target,
    before: { knowledgeCount: before },
    after: {
      knowledgeCount: after,
      categoryTag: `${entry.scope.level}/${entry.category}/${entry.tags[0]}`
    },
    userFacingValue: entry.type === "avoidance" ? `AI \u9047\u5230 "${entry.wrong_pattern}" \u65F6\u4F1A\u6539\u7528 "${entry.correct_pattern}"` : `AI \u4E0B\u6B21\u5728 "${entry.trigger}" \u573A\u666F\u4F1A\u53C2\u8003: ${entry.correct_pattern}`,
    counterfactual: "\u4F60\u4F1A\u770B\u5230 AI \u7B2C\u4E8C\u6B21\u518D\u8E29\u540C\u4E00\u4E2A\u5751"
  });
  const renderer = new StdoutRenderer();
  return renderer.render(bus.drain(), mode);
}
async function runPitfallInteractive(opts = {}) {
  const readline = await import("readline/promises");
  const { stdin, stdout } = await import("process");
  const rl = readline.createInterface({ input: stdin, output: stdout });
  const ask = async (q, fallback = "") => {
    const answer = await rl.question(q);
    return answer.trim() || fallback;
  };
  try {
    stdout.write("\n\u8BB0\u5F55\u4E00\u6761\u8E29\u5751\u7ECF\u9A8C\u2014\u2014\u95EE\u7B54\u5B8C\u6210\u540E\u4F1A\u5199\u5165\u77E5\u8BC6\u5E93 + \u66F4\u65B0 CLAUDE.md\n\n");
    const trigger = await ask("\u89E6\u53D1\u573A\u666F\uFF08\u4EC0\u4E48\u60C5\u51B5\u4E0B\u4F1A\u8E29\u5230\u8FD9\u4E2A\u5751\uFF1F\uFF09: ");
    const wrong = await ask("\u9519\u8BEF\u505A\u6CD5\uFF08\u7559\u7A7A\u8868\u793A practice \u578B\uFF09: ");
    const correct = await ask("\u6B63\u786E\u505A\u6CD5: ");
    const reason = await ask("\u539F\u56E0: ");
    const categoryRaw = await ask(
      "\u5206\u7C7B [C=\u4EE3\u7801 E=\u5DE5\u7A0B S=\u7B56\u7565 K=\u8BA4\u77E5\uFF0C\u9ED8\u8BA4 E]: ",
      "E"
    );
    const tagsRaw = await ask("\u6807\u7B7E\uFF08\u9017\u53F7\u5206\u9694\uFF0C\u53EF\u7A7A\uFF09: ");
    const levelRaw = await ask(
      "\u4F5C\u7528\u57DF [personal/team/global\uFF0C\u9ED8\u8BA4 personal]: ",
      "personal"
    );
    const natureRaw = await ask(
      "\u6027\u8D28 [objective/subjective\uFF0C\u9ED8\u8BA4 subjective]: ",
      "subjective"
    );
    const category = normalizeCategory(categoryRaw);
    const level = normalizeLevel(levelRaw);
    const nature = normalizeNature(natureRaw);
    const tags = tagsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    return await executePitfall(
      { trigger, wrong, correct, reason, category, tags, level, nature },
      opts
    );
  } finally {
    rl.close();
  }
}
function normalizeCategory(raw) {
  const upper = raw.toUpperCase();
  if (upper === "C" || upper === "E" || upper === "S" || upper === "K") return upper;
  return "E";
}
function normalizeLevel(raw) {
  if (raw === "team" || raw === "global") return raw;
  return "personal";
}
function normalizeNature(raw) {
  if (raw === "objective") return "objective";
  return "subjective";
}
function buildToolContextPrompt(entry) {
  return [
    "\u4F60\u662F\u4EE3\u7801\u8D28\u91CF\u89C4\u5219\u5206\u6790\u52A9\u624B\u3002\u7ED9\u5B9A\u4E00\u6761\u7F16\u7A0B\u89C4\u5219\uFF0C\u63CF\u8FF0\u5F53 AI \u4F7F\u7528\u5DE5\u5177\u65F6\uFF0C\u4EC0\u4E48\u6837\u7684\u5177\u4F53\u5DE5\u5177\u64CD\u4F5C\uFF08Bash\u547D\u4EE4\u3001\u6587\u4EF6\u7F16\u8F91\u7B49\uFF09\u4F1A\u89E6\u53D1\u8FD9\u6761\u89C4\u5219\u3002",
    "",
    "\u89C4\u5219\u4FE1\u606F\uFF1A",
    `- \u89E6\u53D1\u573A\u666F: ${entry.trigger}`,
    `- \u9519\u8BEF\u505A\u6CD5: ${entry.wrong_pattern || "(\u65E0)"}`,
    `- \u6B63\u786E\u505A\u6CD5: ${entry.correct_pattern}`,
    `- \u539F\u56E0: ${entry.reasoning}`,
    "",
    "\u75281-2\u53E5\u8BDD\u63CF\u8FF0\uFF1AAI \u4F1A\u6267\u884C\u4EC0\u4E48\u6837\u7684\u5177\u4F53\u5DE5\u5177\u64CD\u4F5C\uFF08\u5982 Bash \u547D\u4EE4\u3001\u5199\u5165\u4EC0\u4E48\u6587\u4EF6\u3001\u7F16\u8F91\u4EC0\u4E48\u4EE3\u7801\uFF09\u624D\u4F1A\u89E6\u53D1\u8FD9\u6761\u89C4\u5219\uFF1F",
    "\u53EA\u63CF\u8FF0\u5DE5\u5177\u64CD\u4F5C\uFF0C\u4E0D\u8981\u8BF4\u573A\u666F\u6216\u539F\u56E0\u3002\u76F4\u63A5\u8F93\u51FA\u63CF\u8FF0\uFF0C\u4E0D\u52A0\u5F15\u53F7\u3002"
  ].join("\n");
}
async function generateToolContextAsync(entry, projectDbPath) {
  const { ClaudeCodeLLMClient, XenovaRuleEmbedder: EmbedderClass, openDb: openDatabase } = await import("./src-WFKRPSJT.js");
  const llm = new ClaudeCodeLLMClient({ model: "haiku" });
  const desc = await llm.complete(buildToolContextPrompt(entry));
  if (!desc || desc.trim().length < 5) return;
  const embedder = new EmbedderClass();
  const [vec] = await embedder.embed([desc.trim()]);
  if (!vec) return;
  const vdb = openDatabase(projectDbPath);
  try {
    vdb.prepare(
      "UPDATE knowledge SET tool_context_description = ? WHERE id = ?"
    ).run(desc.trim(), entry.id);
    syncToolVector(vdb, entry.id, new Float32Array(vec));
  } finally {
    vdb.close();
  }
}
var PITFALL_FIELD_MAX = 1e3;
var PitfallValidationError = class extends Error {
  constructor(missing) {
    super(
      `pitfall --non-interactive \u7F3A\u5C11\u5FC5\u586B\u5B57\u6BB5: ${missing.join(", ")}
\u7528\u6CD5: teamagent pitfall --non-interactive --trigger=... --correct=... --reason=... [--wrong=...]`
    );
    this.missing = missing;
    this.name = "PitfallValidationError";
  }
  missing;
};
function parsePitfallArgs(argv) {
  if (!argv.includes("--non-interactive")) return null;
  const getFlag = (name) => {
    const prefix = `--${name}=`;
    const found = argv.find((a) => a.startsWith(prefix));
    return found ? found.slice(prefix.length) : void 0;
  };
  const trigger = (getFlag("trigger") ?? "").trim();
  const wrong = (getFlag("wrong") ?? "").trim();
  const correct = (getFlag("correct") ?? "").trim();
  const reason = (getFlag("reason") ?? "").trim();
  const categoryRaw = getFlag("category");
  let category;
  if (categoryRaw !== void 0) {
    const upper = categoryRaw.toUpperCase();
    if (upper !== "C" && upper !== "E" && upper !== "S" && upper !== "K") {
      throw new PitfallValidationError([`--category \u5FC5\u987B\u662F C/E/S/K \u4E4B\u4E00\uFF0C\u6536\u5230: "${categoryRaw}"`]);
    }
    category = upper;
  }
  const tagsRaw = getFlag("tags");
  const level = getFlag("level");
  const nature = getFlag("nature");
  const project = getFlag("project");
  const missing = [];
  if (!trigger) missing.push("--trigger");
  if (!correct) missing.push("--correct");
  if (!reason) missing.push("--reason");
  if (missing.length > 0) throw new PitfallValidationError(missing);
  const overLong = [];
  if (trigger.length > PITFALL_FIELD_MAX) overLong.push(`--trigger \u957F\u5EA6 ${trigger.length}`);
  if (wrong.length > PITFALL_FIELD_MAX) overLong.push(`--wrong \u957F\u5EA6 ${wrong.length}`);
  if (correct.length > PITFALL_FIELD_MAX) overLong.push(`--correct \u957F\u5EA6 ${correct.length}`);
  if (reason.length > PITFALL_FIELD_MAX) overLong.push(`--reason \u957F\u5EA6 ${reason.length}`);
  if (overLong.length > 0) {
    throw new PitfallValidationError([
      `\u5B57\u6BB5\u8D85\u957F\uFF08\u6BCF\u5B57\u6BB5\u6700\u5927 ${PITFALL_FIELD_MAX} \u5B57\u7B26\uFF09: ${overLong.join(", ")}`
    ]);
  }
  const tags = tagsRaw ? tagsRaw.split(",").map((s) => s.trim()).filter(Boolean) : void 0;
  return {
    trigger,
    wrong,
    correct,
    reason,
    ...category ? { category } : {},
    ...tags ? { tags } : {},
    ...level ? { level } : {},
    ...nature ? { nature } : {},
    ...project ? { project } : {}
  };
}

export {
  executePitfall,
  runPitfallInteractive,
  PitfallValidationError,
  parsePitfallArgs
};
