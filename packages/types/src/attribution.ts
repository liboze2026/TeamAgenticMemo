/**
 * 归因事件——"TeamAgent 帮你做了什么"的结构化表达。
 *
 * 所有组件通过 AttributionBus 发送此类事件，由 Renderer 统一渲染。
 * 对应 plan v1.2 "三、归因总线" 章节。
 */
export interface AttributionEvent {
  source:
    | "pitfall"
    | "compiler"
    | "hook-pre"
    | "hook-post"
    | "detector"
    | "extractor"
    | "importer"
    | "init"
    | "calibrator"
    | "scenario-runner"
    | "skeleton"
    | "ingest"
    | "validator"
    | "compile"
    | "wiki-refresh";
  action: string;
  target?: { id?: string; file?: string; count?: number };
  before?: unknown;
  after?: unknown;
  /** 对用户有感知价值的一句话："下次遇到 X 会改用 Y" */
  userFacingValue?: string;
  /** 反事实："没有 TeamAgent 你会 Z"，仅 verbose 模式显示 */
  counterfactual?: string;
  severity: "info" | "highlight" | "warning";
  /** ISO 8601 */
  timestamp: string;
}

/**
 * 渲染模式。对齐 spec v5.2 可见性配置。
 *
 * - silent: 全不显示
 * - smart: 显示 highlight + warning，不显示 info 和 counterfactual
 * - verbose: 全显示；末尾附加原始 event JSON
 */
export type VisibilityMode = "silent" | "smart" | "verbose";

// Default changed from "smart" → "verbose" (2026-04-21): users want all
// attribution events visible by default so they can see what TeamAgent did.
// Opt out: TEAMAGENT_VISIBILITY=smart 或 =silent
export const DEFAULT_VISIBILITY: VisibilityMode = "verbose";

/** 从环境变量解析 visibility mode。无效值回退到默认。 */
export function parseVisibilityMode(raw: string | undefined): VisibilityMode {
  if (raw === "silent" || raw === "smart" || raw === "verbose") return raw;
  return DEFAULT_VISIBILITY;
}
