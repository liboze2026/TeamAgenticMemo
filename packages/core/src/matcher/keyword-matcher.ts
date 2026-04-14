import type { KnowledgeEntry } from "@teamagent/types";

export interface ToolCallContext {
  toolName: string;
  input: Record<string, unknown>;
}

const ENFORCEMENT_RANK: Record<KnowledgeEntry["enforcement"], number> = {
  block: 3,
  warn: 2,
  suggest: 1,
  passive: 0,
};

/**
 * 给定工具调用上下文 + 规则集，返回命中的规则。
 * 纯函数。性能目标：100 条规则下 <5ms。
 *
 * 匹配规则（Phase 1 关键词版）：
 * 1. 仅 status=active 且 type=avoidance 的规则参与匹配
 * 2. 收集 wrong_pattern（用 `|` 或 `/` 分隔多个候选）作为关键词
 * 3. 把 input 的 command/content/file_path/url/old_string/new_string 拼成文本
 * 4. 大小写不敏感的子串匹配——任一关键词命中即算命中规则
 * 5. scope.file_types/paths 限制：必须匹配才允许命中
 * 6. 命中按 enforcement 降序返回（block 在前）
 */
export function matchRules(
  ctx: ToolCallContext,
  rules: KnowledgeEntry[],
): KnowledgeEntry[] {
  const inputText = extractInputText(ctx);
  const filePath = stringField(ctx.input, "file_path");

  const matches: KnowledgeEntry[] = [];

  for (const rule of rules) {
    if (rule.status !== "active") continue;
    if (rule.type !== "avoidance") continue;
    if (!rule.wrong_pattern) continue;

    if (!checkScope(rule, filePath)) continue;

    const patterns = splitPatterns(rule.wrong_pattern);
    const lower = inputText.toLowerCase();
    const matched = patterns.some((p) => lower.includes(p.toLowerCase()));
    if (matched) matches.push(rule);
  }

  matches.sort(
    (a, b) => ENFORCEMENT_RANK[b.enforcement] - ENFORCEMENT_RANK[a.enforcement],
  );
  return matches;
}

function extractInputText(ctx: ToolCallContext): string {
  const parts: string[] = [];
  for (const key of [
    "command",
    "content",
    "file_path",
    "url",
    "old_string",
    "new_string",
    "pattern",
    "query",
    "prompt",
  ]) {
    const v = ctx.input[key];
    if (typeof v === "string") parts.push(v);
  }
  return parts.join("\n");
}

function stringField(input: Record<string, unknown>, key: string): string | undefined {
  const v = input[key];
  return typeof v === "string" ? v : undefined;
}

/** 切分时丢弃的最小 token 长度。<3 字符的 token（"a"/"to"）会匹配万物，必须排除。 */
const MIN_TOKEN_LENGTH = 3;

function splitPatterns(raw: string): string[] {
  // 只用 `|` 作为多模式分隔。
  // 早期设计也用 `/`，但 `/` 在 unix 路径里太常见，会把 `import a/b/c` 错切成
  // `a`/`b`/`c` 这种短 token，导致规则乱命中。
  // 同样，<3 字符的 token 也会乱命中（"b" 命中 bar.ts、baz.ts、big.zip 等所有含 b 的字符串）。
  // 0 号用户实际使用时踩到这两个坑。
  const tokens = raw
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length >= MIN_TOKEN_LENGTH);
  // 如果切分后没有合格 token，回退为整体匹配（不切分）
  return tokens.length > 0 ? tokens : [raw.trim()];
}

/**
 * 检查 scope.file_types / paths 限制（如果 rule 设置了的话）。
 *
 * 语义：scope 只限制"哪些文件"被这条规则覆盖，不阻止"非文件操作"被匹配。
 * 因此当 ctx 没有 file_path（典型如 Bash 命令）时，file_types / paths 不适用，
 * 直接放行。例如一条范围是 `*.ts` 的"禁用 axios"规则，Write *.md 不会命中
 * （scope 过滤），但 Bash `npm install axios` 仍会命中（没有 file_path）。
 */
function checkScope(rule: KnowledgeEntry, filePath: string | undefined): boolean {
  if (!filePath) return true;

  const fileTypes = rule.scope.file_types;
  if (fileTypes && fileTypes.length > 0) {
    const ok = fileTypes.some((ft) => matchesGlob(ft, filePath));
    if (!ok) return false;
  }

  const paths = rule.scope.paths;
  if (paths && paths.length > 0) {
    const ok = paths.some((p) => matchesGlob(p, filePath));
    if (!ok) return false;
  }

  return true;
}

/** Phase 1 简化 glob：仅支持 `*` (除 / 外任意) 和 `**` (任意路径) */
function matchesGlob(pattern: string, target: string): boolean {
  // 转义正则特殊字符（除 *）
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "{{DSTAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/{{DSTAR}}/g, ".*");
  return new RegExp(`^${escaped}$`).test(target) || new RegExp(escaped).test(target);
}
