import type { ValidateL0Input, ValidationL0Result } from "@teamagent/ports";

const IMPORT_PATH_RE = /^[@a-zA-Z0-9_\-./]+$/;

/**
 * L0 机械检查——规则入库前的零成本门闸。纯函数，无 IO。
 *
 * 见 docs/superpowers/specs/2026-04-15-phase2-design-v2.md §5.3。
 *
 * 5 项检查：
 *  1. wrong_pattern 的字面量在 sourceText 里真存在（仅 type=avoidance）
 *  2. correct_pattern.import_path 字符串格式合法（如存在）
 *  3. scope.file_types 与项目 stack 有交集（如都非空）
 *  4. 与现有规则无 trigger 字面冲突
 *  5. 对 type=avoidance 的规则，scope.paths 非空且条目字符串合法
 */
export function validateLevel0(input: ValidateL0Input): ValidationL0Result {
  const failed: string[] = [];
  const { entry, sourceText, existingRules, projectStack } = input;

  // 1. wrong_pattern 在源文里真存在
  if (entry.type === "avoidance" && entry.wrong_pattern) {
    const patterns = entry.wrong_pattern
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    const hit = patterns.some((p) => sourceText.includes(p));
    if (!hit) failed.push("wrong_pattern_not_in_source");
  }

  // 2. import_path 字符串合法（字段若来自未来 schema 扩展，尚未在 KnowledgeEntry 里固化）
  const importPath = (entry as { correct_pattern_import_path?: unknown })
    .correct_pattern_import_path;
  if (typeof importPath === "string" && !IMPORT_PATH_RE.test(importPath)) {
    failed.push("invalid_import_path_format");
  }

  // 3. scope.file_types 与 stack 一致
  const fileTypes = entry.scope?.file_types;
  if (fileTypes && fileTypes.length > 0 && projectStack.length > 0) {
    const normalized = fileTypes.map((s) => s.replace(/^\*?\.?/, ""));
    const overlap = normalized.some((t) => projectStack.includes(t));
    if (!overlap) failed.push("file_types_stack_mismatch");
  }

  // 4. trigger 字面冲突（忽略与自己 id 相同的条目）
  if (entry.trigger) {
    const exists = existingRules.some(
      (r) => r.id !== entry.id && r.trigger === entry.trigger,
    );
    if (exists) failed.push("trigger_collision");
  }

  // 5. avoidance 规则 scope.paths 非空且格式合法
  if (entry.type === "avoidance") {
    const paths = entry.scope?.paths;
    if (!paths || paths.length === 0) {
      failed.push("scope_paths_empty");
    } else {
      const malformed = paths.some((p) => typeof p !== "string" || p.length === 0);
      if (malformed) failed.push("scope_paths_malformed");
    }
  }

  return {
    ok: failed.length === 0,
    failed_checks: failed,
    notes: failed.length ? `L0 failed: ${failed.join(", ")}` : undefined,
  };
}
