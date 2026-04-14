import type {
  AttributionBus,
  CorrectionDetector,
  CorrectionMoment,
  KnowledgeExtractor,
  KnowledgeStore,
} from "@teamagent/ports";
import type {
  KnowledgeEntry,
  ParsedSession,
  Scope,
} from "@teamagent/types";
import { computeEnforcement } from "@teamagent/types";

/**
 * 提取 Pipeline 的依赖。所有 IO（LLM/Store/Bus）通过注入传入，保持 core 纯。
 */
export interface ExtractPipelineDeps {
  detector: CorrectionDetector;
  extractor: KnowledgeExtractor;
  callLLM: (prompt: string) => Promise<string>;
  store: KnowledgeStore;
  /** 可选：所有条目写入完成后触发一次全量编译（通常用于 CLAUDE.md）。 */
  recompile?: (activeEntries: KnowledgeEntry[]) => void | Promise<void>;
  /** 可选：归因事件总线。缺省时不 emit。 */
  bus?: AttributionBus;
  /** 新条目挂的 scope。通常 "personal" 或 "team"。 */
  scope: Scope;
  /** 新条目的 source 字段。默认 "accumulated"。 */
  source?: "accumulated" | "team-shared";
  /** 当前时间 getter——注入以便测试固定时间戳。 */
  now: () => Date;
  /** id 生成器——注入以便测试稳定 id。 */
  idGen: () => string;
}

/**
 * 一次 Pipeline 运行的结果摘要。
 */
export interface ExtractPipelineResult {
  /** 识别到的纠正时刻总数 */
  correctionsFound: number;
  /** 成功写入 store 的新条目 */
  extracted: KnowledgeEntry[];
  /** LLM 判定信号太弱（返回 null）跳过的条数 */
  skipped: number;
  /** LLM 或 store 调用失败的条数 */
  failed: number;
}

/**
 * 编排 detector → extractor → store → recompile 一条龙。
 *
 * 每条纠正：
 * 1. extractor.extract 得到 Partial<KnowledgeEntry> | null
 * 2. null → skipped（信号不足）
 * 3. 否则补全必填字段 → store.add → extracted.push → bus.emit
 * 4. 个别失败不影响整体（try/catch），只增 failed 计数
 *
 * 循环结束后：recompile 一次（若提供）。
 */
export async function runExtractPipeline(
  session: ParsedSession,
  deps: ExtractPipelineDeps,
): Promise<ExtractPipelineResult> {
  const corrections = deps.detector.detect(session);
  const result: ExtractPipelineResult = {
    correctionsFound: corrections.length,
    extracted: [],
    skipped: 0,
    failed: 0,
  };

  for (const moment of corrections) {
    const context = formatCorrectionContext(moment);
    try {
      const partial = await deps.extractor.extract(
        { kind: "correction", context, weight: moment.weight },
        deps.callLLM,
      );
      if (partial === null) {
        result.skipped++;
        emit(deps.bus, {
          source: "extractor",
          action: "skipped",
          target: { count: 1 },
          severity: "info",
          userFacingValue: `纠正信号不足，未提取（turn ${moment.turnIndex}）`,
          timestamp: isoNow(deps.now),
        });
        continue;
      }

      const entry = assembleEntry(partial, moment, deps);
      deps.store.add(entry);
      result.extracted.push(entry);
      emit(deps.bus, {
        source: "extractor",
        action: "extracted",
        target: { id: entry.id, count: 1 },
        severity: "highlight",
        userFacingValue: `学到：${entry.trigger} → ${entry.correct_pattern}`,
        timestamp: isoNow(deps.now),
      });
    } catch (err) {
      result.failed++;
      emit(deps.bus, {
        source: "extractor",
        action: "failed",
        target: { count: 1 },
        severity: "warning",
        userFacingValue: `提取失败（turn ${moment.turnIndex}）: ${String(err).slice(0, 120)}`,
        timestamp: isoNow(deps.now),
      });
    }
  }

  if (deps.recompile) {
    try {
      await deps.recompile(deps.store.getActive());
      emit(deps.bus, {
        source: "compiler",
        action: "recompiled",
        target: { count: result.extracted.length },
        severity: "info",
        userFacingValue: `CLAUDE.md 已按新知识重编译（+${result.extracted.length}）`,
        timestamp: isoNow(deps.now),
      });
    } catch (err) {
      emit(deps.bus, {
        source: "compiler",
        action: "failed",
        severity: "warning",
        userFacingValue: `重编译失败: ${String(err).slice(0, 120)}`,
        timestamp: isoNow(deps.now),
      });
    }
  }

  return result;
}

/**
 * 把 CorrectionMoment 拼成交给 LLM 的上下文字符串。
 */
export function formatCorrectionContext(moment: CorrectionMoment): string {
  const tools = moment.previousToolCalls.length
    ? `[AI 之前调用的工具: ${moment.previousToolCalls.join(", ")}]\n`
    : "";
  return [
    `[信号: ${moment.signal}, 权重: ${moment.weight.toFixed(2)}]`,
    moment.previousAssistantText
      ? `AI 之前说: ${truncate(moment.previousAssistantText, 600)}`
      : "",
    tools,
    `用户纠正: ${truncate(moment.correctionText, 600)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * 把 LLM 抽取结果补完成 KnowledgeEntry。
 */
function assembleEntry(
  partial: Partial<KnowledgeEntry>,
  moment: CorrectionMoment,
  deps: ExtractPipelineDeps,
): KnowledgeEntry {
  const confidence = moment.weight;
  const nature = (partial.nature ?? "subjective") as "objective" | "subjective";
  const enforcement = computeEnforcement(confidence, nature);
  const nowIso = isoNow(deps.now);

  return {
    id: deps.idGen(),
    scope: deps.scope,
    category: partial.category ?? "E",
    tags: partial.tags ?? [],
    type: partial.type ?? "avoidance",
    nature,
    trigger: partial.trigger ?? "",
    wrong_pattern: partial.wrong_pattern ?? "",
    correct_pattern: partial.correct_pattern ?? "",
    reasoning: partial.reasoning ?? "",
    confidence,
    enforcement,
    status: "active",
    hit_count: 0,
    success_count: 0,
    override_count: 0,
    evidence: {
      success_sessions: 0,
      success_users: 0,
      correction_sessions: 1,
    },
    created_at: nowIso,
    last_hit_at: "",
    last_validated_at: nowIso,
    source: deps.source ?? "accumulated",
    conflict_with: [],
  };
}

function emit(
  bus: AttributionBus | undefined,
  event: Parameters<AttributionBus["emit"]>[0],
): void {
  if (!bus) return;
  try {
    bus.emit(event);
  } catch {
    // bus 故障不影响主流程
  }
}

function isoNow(now: () => Date): string {
  return now().toISOString();
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + "…";
}
