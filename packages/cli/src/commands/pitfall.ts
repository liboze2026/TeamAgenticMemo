import os from "node:os";
import path from "node:path";
import {
  JsonlKnowledgeStore,
  InMemoryAttributionBus,
  MarkdownCompiler,
  StdoutRenderer,
} from "@teamagent/adapters";
import {
  computeEnforcement,
  parseVisibilityMode,
  type KnowledgeEntry,
} from "@teamagent/types";

/** pitfall 的非 IO 参数——便于测试 */
export interface PitfallInput {
  trigger: string;
  wrong: string;
  correct: string;
  reason: string;
  /** C / E / S / K */
  category?: "C" | "E" | "S" | "K";
  /** 自由标签列表 */
  tags?: string[];
  /** personal / team / global，默认 personal */
  level?: "personal" | "team" | "global";
  /** objective / subjective，默认 subjective（入门友好，不强制 block）*/
  nature?: "objective" | "subjective";
  /** 项目名，为 personal/team scope 附加限定 */
  project?: string;
}

export interface PitfallOptions {
  /** 个人知识文件，默认 ~/.teamagent/personal/knowledge.jsonl */
  personalPath?: string;
  /** 项目知识文件，默认 {cwd}/.teamagent/knowledge.jsonl */
  teamPath?: string;
  /** global 知识文件，默认 ~/.teamagent/global/knowledge.jsonl */
  globalPath?: string;
  /** CLAUDE.md 路径，默认 {cwd}/CLAUDE.md */
  claudeMdPath?: string;
  cwd?: string;
  homeDir?: string;
  now?: () => string;
  env?: Record<string, string | undefined>;
}

function resolvePaths(opts: PitfallOptions) {
  const home = opts.homeDir ?? os.homedir();
  const cwd = opts.cwd ?? process.cwd();
  return {
    personalPath:
      opts.personalPath ?? path.join(home, ".teamagent", "personal", "knowledge.jsonl"),
    teamPath:
      opts.teamPath ?? path.join(cwd, ".teamagent", "knowledge.jsonl"),
    globalPath:
      opts.globalPath ?? path.join(home, ".teamagent", "global", "knowledge.jsonl"),
    claudeMdPath: opts.claudeMdPath ?? path.join(cwd, "CLAUDE.md"),
  };
}

function generateId(level: string, ts: string): string {
  const prefix = level === "personal" ? "pers" : level === "team" ? "team" : "glob";
  const short = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${ts.replace(/[-:T.Z]/g, "").slice(0, 14)}-${short}`;
}

function buildEntry(input: PitfallInput, now: string): KnowledgeEntry {
  const level = input.level ?? "personal";
  const nature = input.nature ?? "subjective";
  const confidence = 0.7; // 新录入默认中等置信度
  const enforcement = computeEnforcement(confidence, nature);
  const category = input.category ?? "E";
  const tags = input.tags && input.tags.length > 0 ? input.tags : [category.toLowerCase()];

  return {
    id: generateId(level, now),
    scope: {
      level,
      ...(input.project ? { project: input.project } : {}),
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
  };
}

/**
 * 核心非 IO 函数：给定 input + paths，写盘 + 编译 CLAUDE.md + 返回归因文本。
 * 供交互模式和非交互模式共用。
 */
export function executePitfall(
  input: PitfallInput,
  opts: PitfallOptions = {},
): string {
  const paths = resolvePaths(opts);
  const now = (opts.now ?? (() => new Date().toISOString()))();
  const mode = parseVisibilityMode(
    (opts.env ?? process.env).TEAMAGENT_VISIBILITY,
  );

  const level = input.level ?? "personal";
  const storePath =
    level === "personal"
      ? paths.personalPath
      : level === "team"
        ? paths.teamPath
        : paths.globalPath;

  const store = new JsonlKnowledgeStore(storePath);
  const before = store.count();

  const entry = buildEntry(input, now);
  store.add(entry);

  // 重新编译 CLAUDE.md —— 合并所有 scope 的活跃条目
  const allActive: KnowledgeEntry[] = [];
  for (const p of [paths.personalPath, paths.teamPath, paths.globalPath]) {
    try {
      const s = new JsonlKnowledgeStore(p);
      allActive.push(...s.getActive());
    } catch {
      // 文件不存在或损坏，跳过
    }
  }

  const compiler = new MarkdownCompiler(paths.claudeMdPath, () => now);
  const writeInfo = compiler.writeToFile(allActive);

  const bus = new InMemoryAttributionBus();
  bus.emit({
    source: "pitfall",
    action: `添加知识条目 ${entry.id} (${entry.category}/${entry.tags[0]})`,
    severity: "highlight",
    timestamp: now,
    target: { file: writeInfo.filePath, count: writeInfo.blockStartLine + 1 },
    before: { knowledgeCount: before },
    after: {
      knowledgeCount: store.count(),
      categoryTag: `${level}/${entry.category}/${entry.tags[0]}`,
    },
    userFacingValue:
      entry.type === "avoidance"
        ? `AI 遇到 "${entry.wrong_pattern}" 时会改用 "${entry.correct_pattern}"`
        : `AI 下次在 "${entry.trigger}" 场景会参考: ${entry.correct_pattern}`,
    counterfactual: "你会看到 AI 第二次再踩同一个坑",
  });

  const renderer = new StdoutRenderer();
  return renderer.render(bus.drain(), mode);
}

/**
 * 交互模式入口——用 readline 从 stdin 收集输入，调用 executePitfall。
 * readline 用动态 import 避免 vitest worker 启动时的副作用（Windows OOM）。
 */
export async function runPitfallInteractive(
  opts: PitfallOptions = {},
): Promise<string> {
  const readline = await import("node:readline/promises");
  const { stdin, stdout } = await import("node:process");
  const rl = readline.createInterface({ input: stdin, output: stdout });

  const ask = async (q: string, fallback = ""): Promise<string> => {
    const answer = await rl.question(q);
    return answer.trim() || fallback;
  };

  try {
    stdout.write("\n记录一条踩坑经验——问答完成后会写入知识库 + 更新 CLAUDE.md\n\n");
    const trigger = await ask("触发场景（什么情况下会踩到这个坑？）: ");
    const wrong = await ask("错误做法（留空表示 practice 型）: ");
    const correct = await ask("正确做法: ");
    const reason = await ask("原因: ");
    const categoryRaw = await ask(
      "分类 [C=代码 E=工程 S=策略 K=认知，默认 E]: ",
      "E",
    );
    const tagsRaw = await ask("标签（逗号分隔，可空）: ");
    const levelRaw = await ask(
      "作用域 [personal/team/global，默认 personal]: ",
      "personal",
    );
    const natureRaw = await ask(
      "性质 [objective/subjective，默认 subjective]: ",
      "subjective",
    );

    const category = normalizeCategory(categoryRaw);
    const level = normalizeLevel(levelRaw);
    const nature = normalizeNature(natureRaw);
    const tags = tagsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    return executePitfall(
      { trigger, wrong, correct, reason, category, tags, level, nature },
      opts,
    );
  } finally {
    rl.close();
  }
}

function normalizeCategory(raw: string): "C" | "E" | "S" | "K" {
  const upper = raw.toUpperCase();
  if (upper === "C" || upper === "E" || upper === "S" || upper === "K") return upper;
  return "E";
}

function normalizeLevel(raw: string): "personal" | "team" | "global" {
  if (raw === "team" || raw === "global") return raw;
  return "personal";
}

function normalizeNature(raw: string): "objective" | "subjective" {
  if (raw === "objective") return "objective";
  return "subjective";
}

/**
 * 解析 CLI 参数，支持 --non-interactive + flag 方式非交互调用。
 * 未指定 --non-interactive 时返回 null（调用方走交互模式）。
 */
export function parsePitfallArgs(argv: string[]): PitfallInput | null {
  if (!argv.includes("--non-interactive")) return null;

  const getFlag = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    const found = argv.find((a) => a.startsWith(prefix));
    return found ? found.slice(prefix.length) : undefined;
  };

  const trigger = getFlag("trigger") ?? "";
  const wrong = getFlag("wrong") ?? "";
  const correct = getFlag("correct") ?? "";
  const reason = getFlag("reason") ?? "";
  const category = getFlag("category") as "C" | "E" | "S" | "K" | undefined;
  const tagsRaw = getFlag("tags");
  const level = getFlag("level") as "personal" | "team" | "global" | undefined;
  const nature = getFlag("nature") as "objective" | "subjective" | undefined;
  const project = getFlag("project");

  const tags = tagsRaw
    ? tagsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  return {
    trigger,
    wrong,
    correct,
    reason,
    ...(category ? { category } : {}),
    ...(tags ? { tags } : {}),
    ...(level ? { level } : {}),
    ...(nature ? { nature } : {}),
    ...(project ? { project } : {}),
  };
}
