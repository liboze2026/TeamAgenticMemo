# TeamAgent — 团队AI自进化引擎 设计文档

> 版本: 1.0 | 日期: 2026-04-13 | 状态: 设计完成，待实施

---

## 一、产品定位

### 一句话定位

> 让团队中每个人的AI，从所有人的经验中持续变聪明。

### 核心愿景

彻底终结"技术分享"——知识不再需要人来分享、人来学习。知识实时地、无感地流动在每个人使用的AI中。

### 目标用户

使用AI编码工具（Claude Code / Cursor / Codex / Trae等）进行日常开发的软件工程团队。

### 打法顺序

1. **个人层** — 我踩过的坑，AI不再犯第二次
2. **团队层** — 我的经验自动流入团队，新同事的AI像老员工一样懂
3. **互联网层** — 系统主动分析外部最佳实践，AI未卜先知
4. **终结技术分享** — 知识自动流动，分享会不再需要存在

### 工具策略

Claude Code优先，预留多工具扩展接口（Cursor / Codex / Trae）。

---

## 二、核心概念

### Deviation（偏差/坑）

AI辅助开发过程中，任何导致结果偏离最佳实践的决策、行为或输出。不只是"错"才是坑，"不够好"也是坑。

### 坑的4层16类分类体系

#### 第一层：代码层（Code Level）

| 类别 | 定义 | 示例 |
|------|------|------|
| C1 语法/运行时错误 | 代码无法编译或运行 | 类型错误、语法错误、空引用 |
| C2 API幻觉 | 调用不存在或已废弃的API/方法/参数 | 幻觉方法名、编造参数 |
| C3 隐蔽逻辑错误 | 代码能跑但结果不对 | 竞态条件、边界缺失、静默丢数据 |
| C4 代码质量偏差 | 代码能工作但不够好 | 重复代码、硬编码、命名混乱 |

#### 第二层：工程层（Engineering Level）

| 类别 | 定义 | 示例 |
|------|------|------|
| E1 技术选型偏差 | 选了能用但非最佳的技术 | 项目用Zustand，AI建议Redux |
| E2 架构决策偏差 | 架构方案可行但不够优 | 过早微服务化、错误分层 |
| E3 流程偏差 | 做事顺序或步骤不对 | 先写代码再设计、跳过测试 |
| E4 配置/环境盲区 | 不了解项目特定配置和约定 | ESLint规则、CI差异、环境变量缺失 |

#### 第三层：策略层（Strategy Level）

| 类别 | 定义 | 示例 |
|------|------|------|
| S1 方向性错误 | 解决问题的整体思路不对 | 前端解决后端问题 |
| S2 过度工程 | 做了不需要做的事 | 未被要求的功能、过度设计 |
| S3 不足工程 | 该做的没做 | 缺少错误处理、安全验证 |
| S4 上下文失明 | 无视项目/业务约束 | 忽略性能预算、合规要求 |

#### 第四层：认知层（Knowledge Level）

| 类别 | 定义 | 示例 |
|------|------|------|
| K1 版本/生态滞后 | 使用过时模式 | Class Component代替Hooks |
| K2 领域知识缺失 | 缺少专业领域知识 | 不了解金融幂等要求 |
| K3 团队隐性知识 | 不了解团队约定和历史决策 | "我们试过X方案放弃了" |
| K4 未知的更优解 | 有更好方案但AI不知道 | 社区新库、成熟设计模式 |

### 纠正时刻（Correction Moment）

用户纠正AI的瞬间——系统最高价值的数据信号。通过多信号融合识别：

| 信号 | 权重 | 说明 |
|------|------|------|
| 显式否定 | 0.95 | "不对"、"别这样"、"换个思路" |
| 多次失败后成功 | 0.85 | 工具调用连续失败N次后成功 |
| 编辑AI代码(git diff) | 0.80 | AI生成代码后用户大幅修改 |
| 覆盖AI建议 | 0.80 | AI建议A，用户选B |
| 会话重启 | 0.70 | 做到一半放弃重来 |
| 长停顿后改方向 | 0.50 | AI回复后沉默很久再给不同指令 |
| 用户override规则 | 0.90 | 用户绕过了Hook规则 |

### 知识条目（Knowledge Entry）

从纠正时刻中提取的结构化经验，是知识库的最小单元：

```json
{
  "id": "rule-001",
  "scope": {
    "level": "global|team|personal",
    "project": "项目标识",
    "paths": ["glob模式"],
    "file_types": ["*.ext"],
    "branches": ["分支名"]
  },
  "category": "C|E|S|K",
  "subcategory": "1-4",
  "type": "avoidance|practice",
  "nature": "objective|subjective",
  "trigger": "触发模式",
  "wrong_pattern": "错误的做法",
  "correct_pattern": "正确的做法",
  "reasoning": "原因分析",
  "confidence": 0.0-1.0,
  "enforcement": "block|warn|suggest|passive",
  "status": "active|conflict|stale|archived",
  "hit_count": 0,
  "success_count": 0,
  "override_count": 0,
  "evidence": {
    "success_sessions": 0,
    "success_users": 0,
    "correction_sessions": 0
  },
  "created_at": "",
  "last_hit_at": "",
  "last_validated_at": "",
  "source": "personal|team|internet",
  "conflict_with": []
}
```

### 知识编译（Knowledge Compilation）

将知识条目编译为目标AI工具可消费的格式。同一份知识，多种输出：
- CLAUDE.md（Claude Code）
- skill文件（Claude Code Skills）
- Hook规则（Claude Code Hooks）
- .cursorrules（Cursor，远期）
- AGENTS.md（Codex，远期）

### 三层知识架构

| 层 | 范围 | 审核 | 存储 |
|----|------|------|------|
| 个人层 | 仅自己 | 无需审核 | ~/.teamagent/personal/ |
| 团队层 | 团队成员 | AI预审 + 人工确认 | {project}/.teamagent/ (git tracked) |
| 互联网层 | 公共知识 | 系统筛选 + 质量评分 | ~/.teamagent/community/ (远期) |

### 设计原则

1. **无感优先** — 用户不需要改变任何工作习惯
2. **渐进信任** — 从个人层开始，用户主动选择开启团队共享
3. **只进不退** — 知识更新必须经过验证，AI只会变好不会变差
4. **工具无关** — 知识与工具解耦，通过编译器适配不同AI工具

---

## 三、系统架构

### 整体架构

```
┌──────────────────────────────────────────────────────────┐
│                  用户正常使用 Claude Code                   │
└─────────────────────────┬────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│  Layer 1: 数据采集层 (Collection Layer)                    │
│                                                           │
│  三通道并行：                                              │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │ 被动监听    │  │ 轻确认        │  │ 主动触发        │   │
│  │ • 会话日志  │  │ • 纠正时刻    │  │ • /pitfall     │   │
│  │ • hooks    │  │   确认弹窗    │  │ • /learn       │   │
│  │ • git diff │  │              │  │ • 用户显式标记  │   │
│  │ • 终端输出  │  │              │  │                │   │
│  └────────────┘  └──────────────┘  └────────────────┘   │
└─────────────────────────┬────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────┐
│  Layer 2: 识别层 (Detection Layer)                        │
│                                                           │
│  纠正时刻识别器 — 多信号融合引擎                            │
│  信号: 显式否定 / 编辑AI代码 / 多次失败后成功 /             │
│        会话重启 / 覆盖建议 / 长停顿改方向 / override规则    │
└─────────────────────────┬────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────┐
│  Layer 3: 分析引擎 (Analysis Engine)                      │
│                                                           │
│  • 归因分类器 — 4层16类 + 根因三分法(规则/AI/环境)          │
│  • 知识提取器 — 结构化提取 + 自动判定enforcement_level     │
│  • 冲突检测器 — 语义冲突检测 + 新旧知识对比                │
│  • 去重/合并器 — 闭环追踪(intervention_id关联干预与结果)   │
└─────────────────────────┬────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────┐
│  Layer 4: 知识库 (Knowledge Base)                         │
│                                                           │
│  存储: JSONL文件 (可git追踪)                               │
│  检索: 本地嵌入向量 + 关键词混合搜索                        │
│                                                           │
│  子系统:                                                   │
│  • 回放验证器 — A/B对比证明知识有效                         │
│  • 衰减引擎 — 基于时间/覆盖/依赖变更的知识衰减             │
│  • 冲突仲裁队列 — 矛盾知识供团队决定                       │
│                                                           │
│  三层: 个人层 / 团队层(审核门) / 互联网层(远期)             │
└─────────────────────────┬────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────┐
│  Layer 5: 输出层 — 五种生效机制 (Enforcement Layer)        │
│                                                           │
│  机制1: Hook实时拦截（强制）                                │
│    • PreToolUse拦截已知错误命令/操作                        │
│    • 自动触发语义查询（解决MCP退化问题）                     │
│    • 覆盖: C1-C4, E3-E4, K1                               │
│    • 用户可 /teamagent override 临时绕过                   │
│                                                           │
│  机制2: Session Monitor（中强，全局纠偏）                   │
│    • 旁路监控智能体自主运行的行为轨迹                        │
│    • 检测连续失败、方向偏差、技术路线冲突                    │
│    • 通过Hook注入警告信息                                  │
│    • 覆盖: E1-E2, S1-S4                                   │
│                                                           │
│  机制3: Prompt动态注入（隐式引导）                          │
│    • 检测会话上下文关键词 → 查知识库 → 注入提醒              │
│    • 覆盖: E1-E2, S1-S4                                   │
│                                                           │
│  机制4: MCP按需查询（AI主动 + Hook自动触发）                │
│    • check_pitfall(context)                               │
│    • get_best_practice(task_type)                         │
│    • report_correction(detail)                            │
│    • get_stats()                                          │
│    • 覆盖: E1-E4, S1-S4, K1-K4                           │
│                                                           │
│  机制5: CLAUDE.md静态编译（预防性）                         │
│    • 最重要的团队约定和高频规则                              │
│    • 覆盖: K1-K4, S4, E2                                  │
│                                                           │
│  知识编译器: 知识库 → CLAUDE.md / skill / hook规则 /       │
│             .cursorrules(远期) / AGENTS.md(远期)           │
│                                                           │
│  Knowledge Portal（活的团队Wiki）:                         │
│  • /teamagent portal — 静态HTML快照                       │
│  • /teamagent portal --live — 实时HTTP服务+WebSocket      │
│  • 仪表盘 / 知识浏览器 / 详情页 / 实时流 / 周报            │
└─────────────────────────┬────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────┐
│  Layer 6: 同步层 (Sync Layer)                             │
│                                                           │
│  MVP: 本地文件 + git仓库同步                               │
│  远期: 云端同步服务                                        │
│                                                           │
│  审核门（团队层）:                                         │
│  • AI预审: 格式/质量/冲突检测                              │
│  • 冲突知识显式标记，供团队讨论                             │
│  • 人工确认 → merge到团队知识库                            │
└──────────────────────────────────────────────────────────┘
```

### 五种生效机制覆盖矩阵

```
              Hook   Monitor  Prompt  MCP    CLAUDE.md
              (强制)  (纠偏)  (引导)  (按需)  (预防)
─────────────────────────────────────────────────────
C1 语法错误    ✓
C2 API幻觉    ✓                       ✓
C3 隐蔽逻辑           ✓      ✓        ✓
C4 代码质量           ✓      ✓        ✓
─────────────────────────────────────────────────────
E1 技术选型           ✓      ✓        ✓
E2 架构决策           ✓      ✓        ✓       ✓
E3 流程偏差    ✓      ✓      ✓        ✓
E4 配置盲区    ✓                       ✓       ✓
─────────────────────────────────────────────────────
S1 方向错误           ✓      ✓        ✓
S2 过度工程           ✓      ✓        ✓
S3 不足工程           ✓      ✓        ✓
S4 上下文失明         ✓      ✓        ✓       ✓
─────────────────────────────────────────────────────
K1 版本滞后    ✓                       ✓       ✓
K2 领域缺失                            ✓       ✓
K3 团队隐性                            ✓       ✓
K4 未知更优解                          ✓
─────────────────────────────────────────────────────
全部16类覆盖：五种机制叠加实现100%覆盖
```

### 规则的作用域(Scope)

```
全局层 (Global) — ~/.teamagent/rules/
  适用于所有项目。例: 本机用python3不是python

  团队层 (Team) — {project}/.teamagent/rules/
    适用于本项目所有成员。例: 本项目用Zustand不用Redux

    个人层 (Personal) — ~/.teamagent/personal/
      仅自己。例: 我的venv路径是xxx
```

优先级: 个人层 > 团队层 > 全局层

规则可限定 `paths`（目录）、`file_types`（文件类型）、`branches`（分支），实现精确生效范围。

### 规则的置信度与执行强度

| 置信度 | enforcement | 行为 |
|--------|-------------|------|
| 0.9-1.0 | block | 强制拦截，Hook阻断 |
| 0.7-0.9 | warn | 警告但不阻断 |
| 0.5-0.7 | suggest | 仅MCP/Prompt可查询 |
| <0.5 | passive | 自动归档 |

新规则起始置信度为0.7（warn级别）。

置信度变化:
- 干预成功: +0.05
- 用户确认有效: +0.1
- 团队成员验证: +0.1
- 干预后仍失败: -0.1
- 用户override: -0.15
- 用户标记错误: 直接归档

### 知识衰减机制

- 被动衰减: 超过N天未触发 → enforcement降级
- 主动失效: 依赖文件(package.json等)变更 → 相关知识标记"待验证"
- 反向信号: override或干预失败 → 置信度下降

### 冲突处理

- 系统自动检测新知识与已有知识的语义冲突
- 冲突知识不静默覆盖，标记为"conflict"状态
- 在团队审核门中显式展示，供团队讨论决定
- 被否决方标记为"archived"并保留原因

### 闭环效果追踪

- 每次干预(Hook/MCP/Prompt)生成 `intervention_id`
- PostToolUse关联执行结果到 `intervention_id`
- 干预成功 → confidence↑ | 干预失败 → confidence↓
- 形成自动校准的反馈环

---

## 四、智能体模式支持

AI编码工具在自主运行时（连续几十次工具调用无人介入），系统通过以下机制持续发挥作用：

### Hook逐次拦截

每次工具调用（Bash/Edit/Write）前后触发，不管是用户手动还是AI自主运行。

作用: 拦截具体的错误命令和操作（代码层C、工程层E3/E4）。

### Session Monitor全局纠偏

旁路监控进程，持续分析AI的行为轨迹：

- 每5次工具调用做一次轻量评估（MVP: 规则模式匹配）
- 检测连续失败（3次以上同类错误）
- 检测方向偏差（安装了不该用的依赖、走了错误的技术路线）
- 通过Hook注入警告信息给AI

作用: 发现整体方向偏差（工程层E1/E2、策略层S1-S4）。

实现:
- PostToolUse Hook将每次调用记录到 `~/.teamagent/sessions/{session_id}.jsonl`
- Session Monitor读取轨迹文件，匹配已知模式
- 产生警告写入 `{session_id}_alerts.json`
- 下一次PreToolUse Hook检查alerts文件并注入给AI

### PostSession分析

会话结束后的完整复盘：

- 分析整个会话轨迹，提取新的知识条目
- 识别会话中的所有纠正时刻
- 更新已有知识的置信度
- 为下次会话做准备

---

## 五、技术选型（MVP）

| 组件 | 选型 | 理由 |
|------|------|------|
| 主语言 | TypeScript | Claude Code生态、MCP SDK原生支持 |
| 知识存储 | JSONL文件 | 简单、可git追踪、与gstack格式兼容 |
| 知识检索 | 本地嵌入向量 + 关键词混合 | 精准且轻量 |
| 会话分析 | Claude API | 用LLM分析LLM的会话 |
| MCP Server | TypeScript + @modelcontextprotocol/sdk | Claude Code原生支持 |
| Hook脚本 | Bash + Node.js | Claude Code hooks机制 |
| 知识编译 | 模板引擎(Handlebars) | 简单灵活 |
| Session Monitor | Node.js后台进程 | 轻量、与主系统同语言 |
| 团队同步 | git | 零基础设施 |
| CLI | Claude Code skill文件 | /pitfall, /teamagent等命令 |

---

## 六、MVP功能范围

### Phase 1: 个人层核心（第1-4周）

目标: 单个用户使用，AI不再犯同样的错误。**Day 1即有价值。**

功能:
1. 预置知识包 — 按技术栈预构建的经验库，随安装分发（解决冷启动）
2. 项目环境推断 — 扫描package.json/CLAUDE.md/配置文件，自动激活对应知识
3. 会话日志解析器 — 解析 ~/.claude/ 下的JSONL会话日志
4. 纠正时刻识别器 — 多信号融合检测（负面信号）
5. 成功模式捕获器 — 检测成功完成/表扬/重复使用（正面信号）
6. 知识提取引擎 — 调用Claude API结构化提取经验（avoidance + practice两类）
7. 本地知识库 — JSONL存储 + 基础检索
8. Hook拦截器 — PreToolUse/PostToolUse hook脚本
9. CLAUDE.md编译器 — 知识库→CLAUDE.md自动更新
10. /pitfall命令 — 用户主动记录踩坑
11. /teamagent stats — 查看统计信息

验证指标: 坑重现率(Pitfall Recurrence Rate)下降; Day 1用户有预置知识生效体验

### Phase 2: 实时防护（第5-8周）

目标: 智能体自主运行时也能实时拦截和纠偏。

功能:
1. Session Monitor — 旁路监控 + 模式匹配告警
2. MCP Server — check_pitfall / get_best_practice / report_correction
3. Hook自动触发MCP — 解决长会话退化问题
4. 置信度自动校准 — 闭环追踪干预效果
5. 知识衰减引擎 — 过期知识自动降级
6. /teamagent override — 临时绕过规则
7. /teamagent rules — 管理活跃规则

验证指标: 首次正确率(First-Time-Right Rate)上升

### Phase 3: 团队层（第9-14周）

目标: 团队知识共享，新人即老员工。

功能:
1. 团队知识库 — {project}/.teamagent/ git tracked
2. 审核门 — AI预审 + 冲突检测 + 人工确认
3. 回放验证器 — A/B对比验证知识有效性
4. 冲突仲裁 — 矛盾知识处理流程
5. 知识编译器多输出 — 同一知识→不同格式
6. /teamagent submit — 提交个人经验到团队
7. /teamagent review — 审核待入库知识
8. 周报生成 — 团队AI进化周报

验证指标: 跨用户避坑率(Cross-User Pitfall Prevention Rate)

### Phase 3.5: Knowledge Portal — 活的团队Wiki（第12-16周）

目标: 让知识可见可浏览，替代传统wiki和技术分享会。

Knowledge Portal不是传统wiki——它是自生长的、实时更新的、由系统运行过程自动填充的知识展示层。

功能:
1. /teamagent portal — 生成静态HTML知识快照，浏览器打开
2. /teamagent portal --live — 启动本地HTTP服务，WebSocket实时推送更新
3. 仪表盘 — 知识库总览、进化曲线、今日拦截数、活跃贡献者
4. 知识浏览器 — 按分类(C/E/S/K)、技术栈、项目、状态多维浏览
5. 知识详情页 — 错误做法、正确做法、原因、生效记录、时间线、关联知识
6. 实时流 — 拦截事件、新发现的坑、验证通过、冲突提醒的时间线
7. 团队周报 — 自动生成，包含拦截统计、贡献排行、进化指标

Portal替代的场景:
- Confluence/Notion wiki → 系统自动生成，永远最新
- 技术分享会 → 打开Portal看实时流
- 新人文档学习 → 新人AI已经知道一切，Portal用来理解"为什么"
- 周报汇报 → Portal自动生成
- 代码审查解释 → Portal上每条知识都有原因和时间线

技术实现:
- 快照模式: 读取JSONL → 生成单文件HTML（含内联CSS/JS）→ 打开浏览器
- 实时模式: Node.js本地HTTP服务 → 监控知识库文件变化 → WebSocket推送

验证指标: 团队wiki页面访问量对比（Portal vs 旧wiki）、技术分享会频率变化

### Phase 4: 互联网层 + 多工具（远期）

功能:
1. 互联网知识源 — 主动爬取/分析外部最佳实践
2. Cursor适配 — .cursorrules编译器
3. Codex适配 — AGENTS.md编译器
4. 云端同步 — 替代git的实时同步
5. 知识市场 — 团队间共享知识库

---

## 七、评估框架

### 产品级指标

| 指标 | 定义 | 目标 |
|------|------|------|
| 坑重现率(PRR) | 同一坑在同一用户重复出现的概率 | 趋近于0 |
| 首次正确率(FTRR) | AI第一方案被接受的概率 | 持续上升 |
| 纠正密度(CD) | 每N个工具调用中纠正时刻数 | 持续下降 |
| 跨用户避坑率(CUPR) | A踩过的坑B成功避开的概率 | >80% |
| 进化周期(ECT) | 从踩坑到全团队受益的时间 | <24h |
| 知识精度(KP) | 经验证有效的知识比例 | >90% |

### 用户体感（周报展示）

```
本周 TeamAgent 报告
  为你拦截了 N 个已知坑
  预计节省 X 小时弯路
  你的AI首次正确率：X% → Y%
  你贡献了 N 条新经验，帮助了 M 位同事
  团队知识库：N 条经验（本周 +M）
```

### 学术评估

测试集构建:
- V0种子集(30用例): 学术论文6大类坑 × 每类5个
- V1基础集(100用例): 互联网挖掘 + 对抗性任务
- V2完整集(300用例): 加入变体和跨域迁移测试
- V3团队集(500用例): 多用户序列化任务

核心指标: PAR(坑避开率)、Learning Curve Slope、Forgetting Rate、Cross-Domain Transfer

---

## 八、风险分析与缓解

### 致命风险

#### 风险1：冷启动——Day 1无价值感

问题: 知识库需要时间积累，但用户在第一天就评估工具。

缓解（Phase 1前置条件）:
1. 预置知识包: 按技术栈预构建50+条经验（React/Python/TypeScript/Prisma/DevOps等），随系统安装分发
2. 项目环境自动推断: 安装时扫描package.json/CLAUDE.md/.cursorrules/tsconfig/git log，自动激活对应知识包并导入已有规则
3. 首次会话即有感知: 明确告知用户加载了多少条经验

#### 风险2：只学负面不学正面

问题: 仅从纠正时刻学习会导致知识库成为纯"不要做X"列表。Trace2Skill研究证明成功+失败结合才有效。

缓解: 增加成功模式捕获。

知识条目增加:
- `type`: "avoidance"(避坑型，来自纠正) | "practice"(实践型，来自成功)
- `evidence.success_sessions`: 验证成功的会话数
- `evidence.success_users`: 验证的不同用户数

成功信号: 一次成功完成(权重0.3) / 用户显式表扬(0.8) / 重复使用模式(0.6) / 多人使用模式(0.9)

#### 风险3：个人偏好被当成团队最佳实践

问题: "python→python3"是客观事实，但"Zustand vs Redux"是主观偏好。不区分会导致团队抵触。

缓解: 知识分两种性质。

知识条目增加:
- `nature`: "objective"(客观事实，有可验证的对错) | "subjective"(主观偏好，多种方案可行)

不同处理:
- objective: 可自动升级enforcement，团队审核快速确认
- subjective: enforcement上限为warn（不block），团队提交需≥2人支持，Portal标注为"团队约定"

### 工程风险

| # | 风险 | 缓解措施 |
|---|------|---------|
| 1 | 会话日志格式依赖 | 解析层版本适配抽象，CC更新时回归测试 |
| 2 | 分析API成本 | 分级：本地模式匹配免费，LLM深度分析按需触发 |
| 3 | Hook延迟 | Hook检查<10ms（纯本地匹配），语义查询异步 |
| 4 | 反馈环振荡 | 标记受干预会话，设置单日知识新增上限 |
| 5 | 隐私顾虑 | 个人数据不上传，团队层仅共享结构化条目不共享原始对话 |
| 6 | 误学习撤销 | 支持"撤回"操作并通知受影响成员 |
| 7 | 沉默错误盲区 | 互联网层弥补 + 回放验证发现 |
| 8 | 知识爆炸 | 衰减清理 + 合并相似 + scope知识上限 |

---

## 九、竞品分析

| 产品/论文 | 与TeamAgent的差异 |
|----------|------------------|
| CLAUDE.md / .cursorrules | 人写人维护的静态规则，不自动进化 |
| gstack /learn | 本地JSONL存储，不支持团队共享，无语义搜索 |
| SkillClaw (2026.4) | 面向通用agent，非软件开发团队 |
| SkillX (2026.4) | 离线批量构建，非实时进化 |
| Trace2Skill (2026.3) | 单智能体优化，非跨用户 |
| Hermes Agent | 单用户框架，无团队协作原语 |
| Memento-Skills | 学术框架，非生产部署 |

TeamAgent的差异化: 面向软件开发团队 + 从"人纠正AI"时刻提取知识 + 实时Hook拦截 + 团队级集体进化 + 可商业化产品

---

## 九、相关论文和资料

- [SkillClaw](https://arxiv.org/abs/2604.08377) — 多用户集体技能进化 (2026.4)
- [SkillX](https://arxiv.org/abs/2604.04804) — 自动构建三层技能知识库 (2026.4)
- [Trace2Skill](https://arxiv.org/abs/2603.25158) — 轨迹蒸馏为可迁移技能 (2026.3)
- [SkillRL](https://arxiv.org/abs/2602.08234) — 递归技能强化学习 (2026.2)
- [SWE-Bench-CL](https://arxiv.org/abs/2507.00014) — 持续学习编码基准 (2025)
- [Encoding Team Standards](https://martinfowler.com/articles/reduce-friction-ai/encoding-team-standards.html) — 团队标准编码 (2026.3)
- [Self-Improving Coding Agents](https://addyosmani.com/blog/self-improving-agents/) — 自改进编码智能体 (2026.1)
- [Hermes Agent](https://yuv.ai/blog/hermes-agent) — 四层记忆自改进AI
- [API Misuse in LLMs](https://arxiv.org/html/2503.22821) — LLM的API误用分类
- [LLM Code Hallucinations](https://arxiv.org/html/2409.20550v1) — 代码幻觉研究
