import type { PreToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";
import { detectCompliedSignals, type OverrideSignalEvent } from "@teamagent/core";

export interface PreToolUseDeps {
  matcher: {
    match(input: { tool_name: string; tool_input: unknown }): Promise<{ matched: any[] }>;
  };
  eventLog: {
    append(e: any): void;
    readLast(n: number): any[];
  };
}

export interface PreToolUseResult {
  permissionDecision: "allow" | "deny" | "ask";
  permissionDecisionReason?: string;
  systemMessage?: string;
}

export function createPreToolUseHandler(deps: PreToolUseDeps) {
  return async (input: PreToolUseHookInput): Promise<PreToolUseResult> => {
    const { tool_name, tool_input } = input;
    const tool_use_id = input.tool_use_id ?? crypto.randomUUID();
    const now = new Date().toISOString();

    const { matched } = await deps.matcher.match({ tool_name, tool_input });

    if (matched.length === 0) {
      // Clean pass — 检测 AI 是否遵守了近期对同 tool 的警告
      const recent = deps.eventLog.readLast(50) as OverrideSignalEvent[];
      const complied = detectCompliedSignals(tool_name, recent, new Date(now));
      for (const c of complied) {
        deps.eventLog.append({
          id: `e-complied-${tool_use_id}-${c.knowledge_id}`,
          kind: "ai.override.complied",
          knowledge_id: c.knowledge_id,
          tool_use_id,
          timestamp: now,
          schema_version: 1,
        });
      }
      deps.eventLog.append({
        id: `e-${tool_use_id}-passed`,
        kind: "hook-pre.passed",
        tool_use_id,
        timestamp: now,
        schema_version: 1,
      });
      return { permissionDecision: "allow" };
    }

    // 取 enforcement 最严格的那条
    const sorted = [...matched].sort(
      (a, b) => severityOrder(b.enforcement) - severityOrder(a.enforcement),
    );
    const top = sorted[0];
    const nowDate = new Date(now);
    const reason =
      top.enforcement === "block"
        ? formatBlockReason(top, nowDate)
        : formatWarnMessage(top, nowDate);

    if (top.enforcement === "block") {
      deps.eventLog.append({
        id: `e-${tool_use_id}-blocked`,
        kind: "hook-pre.blocked",
        knowledge_id: top.id,
        tool_use_id,
        timestamp: now,
        schema_version: 1,
      });
      return { permissionDecision: "deny", permissionDecisionReason: reason };
    }

    // warn / suggest → allow + systemMessage hint
    deps.eventLog.append({
      id: `e-${tool_use_id}-warned`,
      kind: "hook-pre.warned",
      knowledge_id: top.id,
      tool_use_id,
      tool_name,              // M2.5: 供 detectCompliedSignals 用
      timestamp: now,
      schema_version: 1,
    });
    return { permissionDecision: "allow", systemMessage: reason };
  };
}

function severityOrder(e: string): number {
  return ({ block: 3, warn: 2, suggest: 1, passive: 0 } as Record<string, number>)[e] ?? 0;
}

function relativeTime(dateStr: string, now: Date): string {
  const diffMs = now.getTime() - new Date(dateStr).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return "今天";
  if (days < 7) return `${days}天前`;
  if (days < 30) return `${Math.floor(days / 7)}周前`;
  return `${Math.floor(days / 30)}个月前`;
}

function formatWarnMessage(rule: any, now: Date): string {
  const age = rule.created_at ? relativeTime(rule.created_at as string, now) : "未知";
  const conf = typeof rule.confidence === "number" ? rule.confidence.toFixed(2) : "?";
  const content = rule.correct_pattern ?? rule.trigger ?? "";
  return `◈ TeamAgent 经验提醒 [置信度 ${conf} · ${age}学到]\n  → ${content}`;
}

function formatBlockReason(rule: any, now: Date): string {
  const age = rule.created_at ? relativeTime(rule.created_at as string, now) : "未知";
  const conf = typeof rule.confidence === "number" ? rule.confidence.toFixed(2) : "?";
  const hitCount = typeof rule.hit_count === "number" ? rule.hit_count : 0;
  const content = rule.correct_pattern ?? rule.trigger ?? "";
  return `◈ TeamAgent 阻止操作 [置信度 ${conf} · 已触发 ${hitCount} 次 · ${age}学到]\n  → ${content}`;
}
