import type { ExtractionInput } from "@teamagent/ports";

/**
 * 构造给 LLM 的提取 prompt。纯函数。
 *
 * 设计要点：
 * - 只问 LLM 能可靠提取的 8 个字段：category / tags / type / nature /
 *   trigger / wrong_pattern / correct_pattern / reasoning
 * - confidence / enforcement / id / 时间戳 / evidence 由 Pipeline 补全
 * - 要求 LLM 严格输出一段 JSON（可包裹在 ```json fenced block 里）
 *   或输出 `null` 表示这条纠正不适合提取成知识（太琐碎、太个性化等）
 *
 * 输出契约示例：
 * ```json
 * {
 *   "category": "E",
 *   "tags": ["http-client", "tech-choice"],
 *   "type": "avoidance",
 *   "nature": "subjective",
 *   "trigger": "需要发起 HTTP 请求",
 *   "wrong_pattern": "axios",
 *   "correct_pattern": "fetch",
 *   "reasoning": "项目零依赖偏好；fetch 在现代 Node 原生可用"
 * }
 * ```
 */
export function buildExtractionPrompt(input: ExtractionInput): string {
  const header = buildHeader(input.kind);
  const contextBlock = buildContextBlock(input);
  const schema = SCHEMA_BLOCK;
  const examples = EXAMPLES_BLOCK;
  const instructions = INSTRUCTIONS_BLOCK;

  return [header, contextBlock, schema, examples, instructions].join("\n\n");
}

function buildHeader(kind: ExtractionInput["kind"]): string {
  const source =
    kind === "correction"
      ? "用户在 Claude Code 会话中纠正了 AI 的行为"
      : kind === "success"
        ? "用户的一次成功模式（AI 未被纠正且模式被重复使用）"
        : "一段已有的规则文本";
  return `你是知识提取器。任务是把下面这段上下文（${source}）提炼成一条结构化的"知识条目"，供团队 AI 未来参考。`;
}

function buildContextBlock(input: ExtractionInput): string {
  return [
    "【上下文】",
    `信号权重: ${input.weight.toFixed(2)}`,
    "```",
    input.context.trim(),
    "```",
  ].join("\n");
}

const SCHEMA_BLOCK = `【输出字段】
- category: "C" | "E" | "S" | "K"
  - C 代码层（语法、类型、API 用法）
  - E 工程层（架构、依赖、工具链）
  - S 策略层（任务分解、实现顺序、取舍）
  - K 认知层（用户偏好、心智模型、协作方式）
- tags: string[]  自由标签，2-5 个短词；英文或中文均可（如 "http-client" "architecture"）
- type: "avoidance" | "practice"
  - avoidance 避坑（"不要 X"）
  - practice 最佳实践（"就该 X"）
- nature: "objective" | "subjective"
  - objective 客观可验证（语法错误、API 行为）
  - subjective 主观偏好（架构选型、风格）
- trigger: string  何时这条知识生效。一句话，描述场景，不包含具体做法
- wrong_pattern: string  错误做法的关键字/句式；优先写**可被字符串匹配**的字面量（如 "axios"、"import fs"）；不适用时填 ""
- correct_pattern: string  正确做法的关键字/句式或一句话建议
- reasoning: string  一句话解释为什么。包含"为什么错"和"为什么对"`;

const EXAMPLES_BLOCK = `【示例】
示例输入：用户说 "不用 axios，用 fetch，项目要零依赖"，AI 之前建议 axios。
示例输出：
\`\`\`json
{
  "category": "E",
  "tags": ["http-client", "dependency", "tech-choice"],
  "type": "avoidance",
  "nature": "subjective",
  "trigger": "需要发起 HTTP 请求",
  "wrong_pattern": "axios",
  "correct_pattern": "fetch",
  "reasoning": "项目偏好零依赖，fetch 在 Node 18+ 原生可用，无需额外包"
}
\`\`\`

示例输入：用户说 "这思路不对，先写测试再写实现"，AI 直接开始写实现代码。
示例输出：
\`\`\`json
{
  "category": "S",
  "tags": ["tdd", "workflow"],
  "type": "practice",
  "nature": "subjective",
  "trigger": "开始实现新功能前",
  "wrong_pattern": "",
  "correct_pattern": "先写失败测试再写实现（TDD）",
  "reasoning": "团队采用 TDD 节奏：红→绿→重构，能减少回归并强制接口先行"
}
\`\`\`

示例输入：用户说 "不对" 但没给替代方案，上下文也看不出原因。
示例输出：
\`\`\`json
null
\`\`\``;

const INSTRUCTIONS_BLOCK = `【严格要求】
1. 只输出**一段** JSON（在 \`\`\`json fenced block 里）或字面量 \`null\`
2. 不要在 JSON 前后添加任何解释文字
3. 如果上下文信息不足以提取出有用的知识（例如用户只说"不对"但没给替代、或纠正内容太私人化），输出 \`null\`
4. trigger 要写得通用一些，让未来不同任务里都能匹配；不要把具体实现细节写进 trigger
5. wrong_pattern 如果有，优先写字面关键字（可被 substring 匹配），而不是散文`;
