import type {
  AppliedSignal,
  CalibrationResult,
  Calibrator,
} from "@teamagent/ports";
import type { KnowledgeEntry, PersistedEvent } from "@teamagent/types";

/**
 * 默认（rule-based）Calibrator。纯函数。
 *
 * 信号 → 权重表（参考 spec v5.2 "置信度校准"）：
 *
 *   hook-pre.blocked            +0.05  规则成功阻拦（intervention applied）
 *   hook-pre.warned             +0.02  规则给了温和提示
 *   post.success after pre-fire +0.03  规则触发后工具仍成功 → 规则没造成破坏
 *   post.fail after pre.blocked -0.10  规则拦住后用户走的另一条路也失败 → 规则可能错了
 *   5+ 连续成功无失败 bonus     +0.05  proven track record
 *
 * 不实现：
 *   - "用户 override" 信号（要求 protocol 升级，M6 minimum 不做）
 *   - 时间衰减（Phase 2 知识衰减引擎再做）
 *
 * 自动归档：confidence 跌破 0.3 时 status: active → archived。
 * archived / conflict 状态不会被 calibrator 改回 active。
 */

const W_PRE_BLOCKED = 0.05;
const W_PRE_WARNED = 0.02;
const W_POST_SUCCESS_AFTER_FIRE = 0.03;
const W_POST_FAIL_AFTER_BLOCK = -0.1;
const W_STREAK_BONUS = 0.05;
const STREAK_THRESHOLD = 5;
const ARCHIVE_THRESHOLD = 0.3;

export const defaultCalibrator: Calibrator = {
  calibrate(
    entry: KnowledgeEntry,
    events: PersistedEvent[],
  ): CalibrationResult {
    // 只考虑与本 entry 相关的事件
    const ourEvents = events.filter((e) => e.knowledge_id === entry.id);

    const signals: AppliedSignal[] = [];

    // 1. hook-pre.blocked 加分
    const blockedEvents = ourEvents.filter(
      (e) => e.kind === "hook-pre.blocked",
    );
    if (blockedEvents.length > 0) {
      signals.push({
        kind: "hook-pre.blocked",
        weight: blockedEvents.length * W_PRE_BLOCKED,
        event_ids: blockedEvents.map((e) => e.id),
      });
    }

    // 2. hook-pre.warned 加分
    const warnedEvents = ourEvents.filter(
      (e) => e.kind === "hook-pre.warned",
    );
    if (warnedEvents.length > 0) {
      signals.push({
        kind: "hook-pre.warned",
        weight: warnedEvents.length * W_PRE_WARNED,
        event_ids: warnedEvents.map((e) => e.id),
      });
    }

    // 3. post.success / post.fail 关联到 pre 事件
    const postEvents = ourEvents.filter((e) => e.kind === "hook-post.result");
    const preFireByToolUseId = new Map<string, PersistedEvent>();
    for (const e of ourEvents) {
      if (
        (e.kind === "hook-pre.matched" ||
          e.kind === "hook-pre.warned" ||
          e.kind === "hook-pre.blocked") &&
        e.tool_use_id
      ) {
        // 取最后一条覆盖（同一 tool_use_id 应只有一组 pre）
        preFireByToolUseId.set(e.tool_use_id, e);
      }
    }

    const successAfterFire: PersistedEvent[] = [];
    const failAfterBlock: PersistedEvent[] = [];
    for (const post of postEvents) {
      if (!post.tool_use_id) continue;
      const pre = preFireByToolUseId.get(post.tool_use_id);
      if (!pre) continue;
      if (post.result?.succeeded === true) {
        successAfterFire.push(post);
      } else if (post.result?.succeeded === false && pre.kind === "hook-pre.blocked") {
        failAfterBlock.push(post);
      }
    }

    if (successAfterFire.length > 0) {
      signals.push({
        kind: "post.success_after_fire",
        weight: successAfterFire.length * W_POST_SUCCESS_AFTER_FIRE,
        event_ids: successAfterFire.map((e) => e.id),
      });
    }
    if (failAfterBlock.length > 0) {
      signals.push({
        kind: "post.fail_after_block",
        weight: failAfterBlock.length * W_POST_FAIL_AFTER_BLOCK,
        event_ids: failAfterBlock.map((e) => e.id),
      });
    }

    // 4. streak bonus：连续 STREAK_THRESHOLD+ 次 post.success_after_fire 且无 fail
    if (
      successAfterFire.length >= STREAK_THRESHOLD &&
      failAfterBlock.length === 0
    ) {
      signals.push({
        kind: "streak_bonus",
        weight: W_STREAK_BONUS,
      });
    }

    const totalDelta = signals.reduce((s, sig) => s + sig.weight, 0);
    const rawNewConf = entry.confidence + totalDelta;
    const newConfidence = Math.max(0, Math.min(1, rawNewConf));

    // 自动归档：active + 跌破阈值 → archived
    let newStatus: KnowledgeEntry["status"] = entry.status;
    if (entry.status === "active" && newConfidence < ARCHIVE_THRESHOLD) {
      newStatus = "archived";
    }
    // archived / conflict / stale 状态保持

    return {
      confidence: newConfidence,
      status: newStatus,
      delta: newConfidence - entry.confidence,
      applied_signals: signals,
    };
  },
};
