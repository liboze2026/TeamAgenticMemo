import type { PreToolUseHookInput } from "@anthropic-ai/claude-agent-sdk";

export interface PreToolUseDeps {
  matcher: {
    match(input: { tool_name: string; tool_input: unknown }): Promise<{ matched: any[] }>;
  };
  eventLog: { append(e: any): void };
}

export interface PreToolUseResult {
  permissionDecision: "allow" | "deny" | "ask";
  permissionDecisionReason?: string;
  systemMessage?: string;
}

export function createPreToolUseHandler(deps: PreToolUseDeps) {
  return async (input: PreToolUseHookInput): Promise<PreToolUseResult> => {
    const { tool_name, tool_input, tool_use_id } = input;
    const now = new Date().toISOString();

    const { matched } = await deps.matcher.match({ tool_name, tool_input });

    if (matched.length === 0) {
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
    const reason = formatReason(top);

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
      timestamp: now,
      schema_version: 1,
    });
    return { permissionDecision: "allow", systemMessage: reason };
  };
}

function severityOrder(e: string): number {
  return ({ block: 3, warn: 2, suggest: 1, passive: 0 } as Record<string, number>)[e] ?? 0;
}

function formatReason(rule: any): string {
  const tier = rule.current_tier ?? "unknown";
  const correct = rule.correct_pattern ?? "";
  const reasoning = rule.reasoning ?? "";
  return `[${tier}] ${rule.trigger ?? ""}: ${correct}\n理由: ${reasoning}`;
}
