# TeamAgent — 团队AI自进化引擎 设计文档

> 版本: 4.0 | 日期: 2026-04-13 | 状态: 设计完成，待实施

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

## 二、系统形态与用户旅程

### TeamAgent是什么

TeamAgent是一个**常驻后台的智能知识服务**，以MCP Server为核心，配合Hook脚本和Skill命令，无感地嵌入AI编码工具的工作流中。

它不是一个独立的应用，而是AI编码工具的"经验层"——让AI拥有记忆、拥有团队的集体智慧。

### 运行形态

```
TeamAgent = MCP Server（核心——AI的实时知识顾问）
          + Hook脚本（执行臂——工具调用的安全护栏）
          + Skill命令（用户接口——可选的主动操作）
          + 知识引擎（大脑——采集/分析/存储/编译/衰减）
          + Knowledge Portal（可视化窗口——活的团队wiki）
```

通过一条命令安装，之后完全后台运行：

```bash
npx teamagent init
# 扫描项目 → 加载知识包 → 注册MCP/Hook/Skill → 完成
```

### 用户旅程：一天的体验

**早上9:00 — 开始工作**

打开Claude Code，照常写代码。CLAUDE.md中已包含TeamAgent编译的知识摘要，AI从第一句话开始就"知道"项目约定和团队经验。

**9:15 — AI差点犯错但被挡住了（无感）**

让AI写一个数据库查询。AI在思考过程中自动调用MCP `check_pitfall`，查到"Prisma日期过滤要用gte不是gt"，直接写出正确代码。用户什么都没感觉到，只是觉得AI很靠谱。

**10:30 — AI执行命令时被纠正（几乎无感）**

AI准备执行 `npm install moment`，Hook检测到规则"用dayjs替代moment"，AI自动改用dayjs。用户看到AI直接装了dayjs，没有经历试错。

smart模式下用户看到：`💡 TeamAgent: 已应用经验——优先使用dayjs而非moment（置信度0.88）`

**11:00 — 用户纠正了AI（系统默默学习）**

AI建议用REST API，用户说"我们这个场景用GraphQL更合适"。系统识别到纠正时刻，后台提取知识。

**14:00 — 智能体自主运行，系统全程守护**

让AI自主重构一个模块（30+步）。Session Monitor全程旁观，在AI偏离技术路线时注入提醒，在连续失败时主动告警。用户没有介入，但AI像有经验的开发者一样自我修正。

**16:00 — 顺手分享一条经验（30秒）**

用户觉得今天纠正AI的那条经验挺有价值，执行 `/teamagent submit`，一键提交到团队知识库。

**17:00 — 看一眼今天的成果（可选）**

执行 `/teamagent portal`，看到：今天系统为自己拦截了8个已知坑，团队知识库新增了5条，首次正确率比上周提升了3%。

**隔壁新同事的体验**

新同事第一天安装TeamAgent，AI就已经知道了：团队用JWT不用Session、日期处理用dayjs、这个项目的API命名规范是什么... 就好像AI跟着团队干了一年一样。

---

## 三、核心概念

### Deviation（偏差/坑）

AI辅助开发过程中，任何导致结果偏离最佳实践的决策、行为或输出。不只是"错"才是坑，"不够好"也是坑。

### 可进化的坑分类体系

分类体系分为**固定层**（4个大类，不变）和**动态层**（子标签，系统自动发现和维护）。

#### 固定层：4个大类

| 大类 | 定义 | 初始子标签（预置，可进化） |
|------|------|--------------------------|
| **C 代码层** | 看得见的坑——代码本身的问题 | syntax-error, api-hallucination, hidden-logic, code-quality, security, performance, type-error |
| **E 工程层** | 做法的坑——工程方式的问题 | tech-choice, architecture, workflow-order, config-blindspot, testing-strategy, dependency-mgmt, deployment |
| **S 策略层** | 思路的坑——决策方向的问题 | wrong-direction, over-engineering, under-engineering, context-blindness |
| **K 认知层** | 知识的坑——不知道有更好的做法 | version-lag, domain-gap, team-tacit, unknown-better-solution |

#### 动态层：子标签自进化

知识条目不再使用固定的subcategory编号，而是使用**自由标签**：

```json
{
  "category": "C",
  "tags": ["api-hallucination", "stripe", "nonexistent-method"]
}
```

系统定期运行**分类自审**（每积累50条新知识时触发）：

1. **聚类分析**: 发现频繁共现的标签集合和无法被现有标签描述的知识 → 提议新标签
2. **分布分析**: 标签过多的大类可能需要拆分（如"code-quality"中性能相关知识过多 → 独立为"performance"）
3. **新模式发现**: 最近N条知识中频繁出现但无对应标签的关键词 → 自动提议新标签
4. **衰减清理**: 长期无新增的标签 → 标记为过时

分类自审结果:
- 更新Knowledge Portal的分类视图
- 调整CLAUDE.md编译器的优先级权重
- 团队层以"分类更新建议"形式提交审核

#### 初始分类参考（预置子标签的详细说明）

**代码层 C:**

| 子标签 | 定义 | 示例 |
|--------|------|------|
| syntax-error | 代码无法编译或运行 | 类型错误、语法错误、空引用 |
| api-hallucination | 调用不存在或已废弃的API/方法/参数 | 幻觉方法名、编造参数 |
| hidden-logic | 代码能跑但结果不对 | 竞态条件、边界缺失、静默丢数据 |
| code-quality | 代码能工作但不够好 | 重复代码、硬编码、命名混乱 |
| security | 引入安全漏洞 | SQL注入、XSS、硬编码密钥、不安全的依赖 |
| performance | 引入性能问题 | N+1查询、不必要重渲染、内存泄漏、bundle过大 |
| type-error | 类型系统相关错误 | 错误的类型断言、any滥用、泛型误用 |

**工程层 E:**

| 子标签 | 定义 | 示例 |
|--------|------|------|
| tech-choice | 选了能用但非最佳的技术 | 项目用Zustand，AI建议Redux |
| architecture | 架构方案可行但不够优 | 过早微服务化、错误分层 |
| workflow-order | 做事顺序或步骤不对 | 先写代码再设计、跳过测试 |
| config-blindspot | 不了解项目特定配置和约定 | ESLint规则、CI差异、环境变量缺失 |
| testing-strategy | 测试方案不当 | 该集成测试用了mock、缺少边界测试、测试覆盖不足 |
| dependency-mgmt | 依赖管理问题 | 依赖冲突、peer dependency、引入已知漏洞的版本 |
| deployment | 部署和DevOps问题 | Dockerfile配置错误、CI/CD管道问题、环境差异 |

**策略层 S:**

| 子标签 | 定义 | 示例 |
|--------|------|------|
| wrong-direction | 解决问题的整体思路不对 | 前端解决后端问题 |
| over-engineering | 做了不需要做的事 | 未被要求的功能、过度设计 |
| under-engineering | 该做的没做 | 缺少错误处理、安全验证、日志 |
| context-blindness | 无视项目/业务约束 | 忽略性能预算、合规要求 |

**认知层 K:**

| 子标签 | 定义 | 示例 |
|--------|------|------|
| version-lag | 使用过时模式 | Class Component代替Hooks |
| domain-gap | 缺少专业领域知识 | 不了解金融幂等要求 |
| team-tacit | 不了解团队约定和历史决策 | "我们试过X方案放弃了" |
| unknown-better-solution | 有更好方案但AI不知道 | 社区新库、成熟设计模式 |

### AI进化的五个维度

系统让AI在五个维度上持续进化，形成复合效应：

**维度一：事实记忆** — "记住具体的对和错"

环境事实（本机python3不是python）、API事实（Stripe方法不存在）、配置事实（ESLint用单引号）。这是最基础的进化，一周内AI就不再在明显事实上犯错。

**维度二：操作模式** — "记住怎么做某件事"

完成某类任务的步骤序列和工具组合。比如"在这个项目里创建新API endpoint的正确步骤是1→2→3→4→5"。AI做事的步骤顺序越来越对，不再跳步漏步。

**维度三：决策偏好** — "记住在这个团队里怎么选"

面对多个可行方案时，团队偏好什么。状态管理用Zustand、日期用dayjs、CSS用Tailwind。AI的建议越来越符合团队风格，code review修改越来越少。

**维度四：避坑经验** — "记住哪里有坑以及为什么"

不只是"别这样做"，而是理解坑的触发条件和根因。AI开始能预判风险并主动规避，而不是撞上去再修。

**维度五：元认知** — "知道自己不知道什么"

AI学会在关键决策点变得谨慎而非自信，会主动说"这个地方我不确定，让我先查一下"。

### 进化的时间线

| 阶段 | 时间 | 主要进化维度 | AI表现 |
|------|------|-------------|--------|
| 事实积累期 | Week 1 | 事实记忆 | 不再在明显事实上犯错 |
| 模式形成期 | Week 2-4 | 操作模式+决策偏好 | 做事步骤和选择越来越对 |
| 经验深化期 | Month 2-3 | 避坑经验 | 能预判风险，主动规避 |
| 智慧涌现期 | Month 3+ | 元认知 | 知道什么时候该确认而不是自信犯错 |

### 进化的四个驱动力

知识不只是越来越多，而是越来越好：

1. **积累** — 知识条目数量增长，AI知道的越来越多
2. **校准** — 好知识升级（confidence↑），坏知识淘汰（confidence↓→归档）。自然选择。
3. **泛化** — 多条具体事实进化为通用模式。"python用python3" → "本机所有python命令都要用python3前缀" → "本机环境与AI默认假设的差异列表"
4. **连接** — 散点知识形成网络。"Prisma日期用gte" 关联到 "所有边界条件处理都应包含边界值"，进而关联到SQL查询、分页逻辑等

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

### 成功信号（Success Signal）

AI做对的时刻——与纠正时刻互补，构建正面知识。

| 信号 | 权重 | 说明 |
|------|------|------|
| 一次成功完成 | 0.30 | AI方案直接被接受且执行成功 |
| 用户显式表扬 | 0.80 | "很好"、"完美"、"就是这样" |
| 重复使用模式 | 0.60 | 同一人多次让AI用同样方式做事 |
| 多人使用模式 | 0.90 | 不同成员都接受了同一种AI方案 |

### 知识条目（Knowledge Entry）

知识库的最小单元，从纠正时刻或成功信号中提取：

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
  "tags": ["子标签（自由标签，系统自动聚类）"],
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

字段说明:
- `type`: avoidance(避坑型——"不要做X") | practice(实践型——"做Y效果好")
- `nature`: objective(客观事实，可验证) | subjective(主观偏好，多方案可行)
- `enforcement`: block(强制拦截,≥0.9) | warn(警告,0.7-0.9) | suggest(可查询,0.5-0.7) | passive(归档,<0.5)

#### 知识条目示例

**示例1: 代码层 + objective + avoidance**
```json
{
  "id": "personal-001",
  "scope": {"level": "global"},
  "category": "C", "tags": ["syntax-error", "python-version"],
  "type": "avoidance", "nature": "objective",
  "trigger": "执行python命令",
  "wrong_pattern": "python script.py",
  "correct_pattern": "python3 script.py",
  "reasoning": "本机的python指向Python 2.7，python3才是Python 3.11",
  "confidence": 0.95, "enforcement": "block",
  "status": "active", "hit_count": 47, "success_count": 47, "override_count": 0,
  "evidence": {"correction_sessions": 1, "success_sessions": 47, "success_users": 1},
  "source": "personal"
}
```

**示例2: 工程层 + subjective + avoidance**
```json
{
  "id": "team-015",
  "scope": {"level": "team", "project": "my-saas-app"},
  "category": "E", "tags": ["tech-choice", "state-management", "zustand"],
  "type": "avoidance", "nature": "subjective",
  "trigger": "状态管理方案选择",
  "wrong_pattern": "引入Redux/MobX/Jotai",
  "correct_pattern": "使用Zustand",
  "reasoning": "团队约定使用Zustand，追求轻量级状态管理",
  "confidence": 0.82, "enforcement": "warn",
  "status": "active", "hit_count": 12, "success_count": 10, "override_count": 1,
  "evidence": {"correction_sessions": 3, "success_sessions": 10, "success_users": 3},
  "source": "team"
}
```

**示例3: 策略层 + objective + practice**
```json
{
  "id": "team-042",
  "scope": {"level": "team", "project": "my-saas-app", "paths": ["src/api/**"]},
  "category": "S", "tags": ["under-engineering", "api-endpoint", "validation", "error-handling"],
  "type": "practice", "nature": "objective",
  "trigger": "创建新API endpoint",
  "wrong_pattern": "",
  "correct_pattern": "每个API endpoint必须包含：输入验证(zod)、错误处理(try-catch+自定义Error)、请求日志(logger.info)、响应类型定义",
  "reasoning": "缺少这些要素的API在生产环境中多次导致问题。张三的支付接口因缺少输入验证导致了一次线上事故。",
  "confidence": 0.91, "enforcement": "block",
  "status": "active", "hit_count": 8, "success_count": 8, "override_count": 0,
  "evidence": {"correction_sessions": 2, "success_sessions": 8, "success_users": 4},
  "source": "team"
}

### 知识编译（Knowledge Compilation）

将知识条目编译为目标AI工具可消费的格式。同一份知识，多种输出：
- CLAUDE.md（Claude Code）— Phase 1唯一的分发渠道
- skill文件（Claude Code Skills）
- Hook规则（Claude Code Hooks）
- .cursorrules（Cursor，远期）
- AGENTS.md（Codex，远期）

#### CLAUDE.md编译策略（Phase 1核心）

**容量限制**: 研究表明CLAUDE.md在~100行（约2000 tokens）时效果最佳，超过后AI逐渐忽略规则。TeamAgent管理的区块上限为**50行**（给用户自己的内容留空间）。

**内容共存**: 不覆盖用户已有内容。在CLAUDE.md中维护一个标记区块：
```markdown
<!-- TEAMAGENT:START - 自动管理，请勿手动编辑 -->
## TeamAgent 经验
...（自动编译的知识，最多50行）
<!-- TEAMAGENT:END -->
```
用户在标记区块外的内容不受影响。

**优先级排序**: 50行预算内，按以下优先级选取知识条目：
1. enforcement=block的规则（必须包含，通常很少）
2. confidence最高 + hit_count最多的规则（经过验证的高频知识）
3. 最近被触发的规则（当前活跃的知识）
4. 与当前项目技术栈匹配的规则

**编译时机**:
- 每次会话结束后，如果知识库有变更 → 重新编译
- 用户执行 /teamagent compile → 手动触发重新编译
- 不在会话进行中重新编译（避免mid-session不一致）

**编译格式**: 简洁的规则列表，每条一行，最重要的在前：
```markdown
<!-- TEAMAGENT:START -->
## TeamAgent 经验（23条活跃知识，为你编译了Top 15）
- 本机使用python3而非python [置信度0.95, 拦截47次]
- Prisma日期过滤使用gte/lte（闭区间），不是gt/lt [0.92, 34次]
- 本项目状态管理使用Zustand，不引入Redux [团队约定]
- ...
<!-- TEAMAGENT:END -->
```

### 三层知识架构

| 层 | 范围 | 审核 | 存储 |
|----|------|------|------|
| 个人层 | 仅自己 | 无需审核 | ~/.teamagent/personal/ |
| 团队层 | 团队成员 | AI预审 + 人工确认 | {project}/.teamagent/ (git tracked) |
| 互联网层 | 公共知识 | 系统筛选 + 质量评分 | ~/.teamagent/community/ (远期) |

### 可见性配置（Visibility Mode）

用户可控的系统感知度，通过 `/teamagent config visibility <mode>` 设置：

| 模式 | 成功干预 | 失败干预 | 查询无结果 | 适合谁 |
|------|---------|---------|-----------|--------|
| **smart**（默认） | 显示归因 | 静默 | 静默 | 大多数用户——只在帮到你时刷存在感 |
| **silent** | 静默 | 静默 | 静默 | 追求极致无感的用户 |
| **verbose** | 显示归因 | 显示失败并标注置信度已降低 | 显示已查询 | 调试系统/想了解系统运作的用户 |

### 设计原则

1. **无感优先** — 用户不需要改变任何工作习惯
2. **渐进信任** — 从个人层开始，用户主动选择开启团队共享
3. **只进不退** — 知识更新必须经过验证，AI只会变好不会变差
4. **工具无关** — 知识与工具解耦，通过编译器适配不同AI工具
5. **可控感知** — 用户决定系统的存在感强度（smart/silent/verbose）

---

## 四、系统架构

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
│  纠正时刻识别器 — 多信号融合引擎（负面信号）                 │
│  成功模式捕获器 — 成功/表扬/重复使用检测（正面信号）         │
└─────────────────────────┬────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────┐
│  Layer 3: 分析引擎 (Analysis Engine)                      │
│                                                           │
│  • 归因分类器 — 4层16类 + 根因三分法(规则/AI/环境)          │
│  • 知识提取器 — 结构化提取(avoidance+practice两类)         │
│  • 性质判定器 — objective vs subjective自动判定            │
│  • 冲突检测器 — 语义冲突检测 + 新旧知识对比                │
│  • 去重/合并器 — 闭环追踪(intervention_id关联干预与结果)   │
└─────────────────────────┬────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────┐
│  Layer 4: 知识库 (Knowledge Base)                         │
│                                                           │
│  存储: JSONL文件 (可git追踪)                               │
│  检索: 分阶段检索（见知识检索策略）                          │
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
│  Layer 5: 输出层 (Delivery Layer)                         │
│                                                           │
│  五种帮助方式:                                             │
│                                                           │
│  ① 预装知识 — "AI从一开始就很懂"                           │
│    实现: CLAUDE.md编译 + skill文件                         │
│    时机: 每次会话开始                                      │
│                                                           │
│  ② 实时顾问 — "AI做事前会先想想有没有坑"（核心）           │
│    实现: MCP Server                                       │
│    工具: check_pitfall / get_best_practice /              │
│          report_correction / get_stats                    │
│    时机: AI思考过程中（主动调用 + Hook自动触发）            │
│                                                           │
│  ③ 安全护栏 — "AI不会执行已知的错误操作"                   │
│    实现: Hook脚本 PreToolUse/PostToolUse                   │
│    时机: 每次工具调用前                                    │
│    用户可 /teamagent override 临时绕过                     │
│                                                           │
│  ④ 全局视野 — "AI会自己发现自己跑偏了"                     │
│    实现: Session Monitor + Prompt动态注入                  │
│    时机: 智能体自主运行时（每5次工具调用评估一次）          │
│                                                           │
│  ⑤ 持续学习 — "AI每天都比昨天聪明一点"                     │
│    实现: PostSession分析                                   │
│    时机: 每次会话结束后                                    │
│                                                           │
│  知识编译器: 知识库 → CLAUDE.md / skill / hook规则 /       │
│             .cursorrules(远期) / AGENTS.md(远期)           │
│                                                           │
│  Knowledge Portal（活的团队Wiki）:                         │
│  • /teamagent stats — 终端统计摘要（Phase 1即可用）        │
│  • /teamagent portal — 静态HTML快照                       │
│  • /teamagent portal --live — 实时HTTP服务+WebSocket      │
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
│  • objective知识: 快速确认即可                             │
│  • subjective知识: 需≥2人支持，标注为"团队约定"            │
│  • 冲突知识显式标记，供团队讨论                             │
│  • 人工确认 → merge到团队知识库                            │
└──────────────────────────────────────────────────────────┘
```

### 五种帮助方式覆盖矩阵

```
             预装知识 实时顾问 安全护栏 全局视野 持续学习
             ①       ②       ③       ④       ⑤
─────────────────────────────────────────────────────
C1 语法错误                   ✓               ✓
C2 API幻觉           ✓       ✓               ✓
C3 隐蔽逻辑          ✓               ✓       ✓
C4 代码质量          ✓               ✓       ✓
─────────────────────────────────────────────────────
E1 技术选型          ✓               ✓       ✓
E2 架构决策  ✓       ✓               ✓       ✓
E3 流程偏差          ✓       ✓       ✓       ✓
E4 配置盲区  ✓       ✓       ✓               ✓
─────────────────────────────────────────────────────
S1 方向错误          ✓               ✓       ✓
S2 过度工程          ✓               ✓       ✓
S3 不足工程          ✓               ✓       ✓
S4 上下文失明 ✓      ✓               ✓       ✓
─────────────────────────────────────────────────────
K1 版本滞后  ✓       ✓       ✓               ✓
K2 领域缺失  ✓       ✓                       ✓
K3 团队隐性  ✓       ✓                       ✓
K4 未知更优解        ✓                       ✓
─────────────────────────────────────────────────────
全部16类覆盖：五种方式叠加实现100%覆盖
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

### 置信度与执行强度

| 置信度 | enforcement | 行为 |
|--------|-------------|------|
| 0.9-1.0 | block | 强制拦截（仅objective知识可达此级） |
| 0.7-0.9 | warn | 警告但不阻断 |
| 0.5-0.7 | suggest | 仅实时顾问(MCP)可查询 |
| <0.5 | passive | 自动归档 |

新规则起始置信度为0.7。subjective知识的enforcement上限为warn。

置信度变化:
- 干预成功 +0.05 / 用户确认有效 +0.1 / 团队成员验证 +0.1
- 干预后仍失败 -0.1 / 用户override -0.15 / 用户标记错误 → 直接归档

### 知识衰减

- 被动衰减: 超过N天未触发 → enforcement降级
- 主动失效: 依赖文件(package.json等)变更 → 相关知识标记"待验证"
- 反向信号: override或干预失败 → 置信度下降

### 冲突处理

- 自动检测新旧知识的语义冲突 → 标记为"conflict"
- 团队审核门中显式展示冲突 → 团队讨论决定
- 被否决方标记为"archived"并保留原因

### 知识检索策略（知识库>50条时生效）

**CLAUDE.md编译时（50行预算内选取最重要的知识）**:

选取漏斗: 全部知识 → scope匹配当前项目 → 排除archived/stale → 按score排序 → Top 15

score = confidence × 0.4 + hit_count归一化 × 0.3 + 时间衰减 × 0.2 + enforcement权重 × 0.1

初期简化版: 知识库<50条时全部放进去，超50行时启用优先级排序。

**MCP实时查询时（从大知识库中检索相关条目）**:

Stage 1 粗筛（毫秒级）: 查询关键词 → trigger字段匹配 → ~20条候选
Stage 2 语义排序（百毫秒级）: 本地嵌入模型 → 语义相似度排序 → Top 5
Stage 3 上下文过滤（毫秒级）: scope.paths/file_types匹配 + confidence≥0.5 → 3-5条返回

**知识库长期瘦身（1000+条时）**:

- 自动合并: 语义相似条目合并
- 层级提升: 多条具体规则泛化为一条通用规则
- 活跃度清理: 90天未命中 + confidence<0.6 → 自动归档
- scope收窄: 全局规则只在特定项目触发 → 自动收窄

### 闭环效果追踪

- 每次干预生成 `intervention_id`
- PostToolUse关联执行结果到 `intervention_id`
- 干预成功 → confidence↑ | 干预失败 → confidence↓

---

## 五、智能体模式支持

AI编码工具在自主运行时（连续几十次工具调用无人介入），五种帮助方式持续作用：

- **安全护栏(③)**: 每次工具调用前后触发，拦截具体错误操作
- **全局视野(④)**: Session Monitor旁路监控行为轨迹，每5次调用评估一次，检测连续失败和方向偏差，通过Hook注入警告
- **实时顾问(②)**: Hook自动触发MCP查询（不依赖AI主动调用，解决长会话退化问题）
- **持续学习(⑤)**: PostSession完整复盘，提取新知识，更新置信度

Session Monitor实现:
- PostToolUse记录到 `~/.teamagent/sessions/{session_id}.jsonl`
- Monitor匹配已知模式 → 产生警告写入 `{session_id}_alerts.json`
- 下次PreToolUse检查alerts文件并注入给AI

---

## 六、项目结构与安装

### 项目目录结构

```
teamagent/
├── packages/
│   ├── engine/                # 知识引擎（核心）
│   │   ├── analyzer/          # 会话分析 + 纠正识别 + 知识提取
│   │   ├── knowledge-base/    # JSONL存储 + 检索
│   │   ├── compiler/          # 知识→CLAUDE.md/skill/hook编译
│   │   └── decay/             # 衰减引擎
│   │
│   ├── mcp-server/            # MCP Server
│   │   └── tools/             # check_pitfall / get_best_practice / ...
│   │
│   ├── hooks/                 # Hook脚本
│   │   ├── pre-tool-use.sh
│   │   ├── post-tool-use.sh
│   │   └── session-monitor.sh
│   │
│   ├── skills/                # Claude Code skill命令
│   │   ├── pitfall.md
│   │   ├── teamagent-stats.md
│   │   ├── teamagent-submit.md
│   │   └── ...
│   │
│   └── portal/                # Knowledge Portal
│       └── index.html
│
├── knowledge-packs/           # 预置知识包
│   ├── react-nextjs.jsonl
│   ├── python-fastapi.jsonl
│   ├── typescript.jsonl
│   └── ...
│
└── cli/                       # 安装/初始化CLI
    └── init.ts
```

### 安装流程（npx teamagent init）

执行后系统做的事：

1. 扫描项目：读package.json/tsconfig/CLAUDE.md等 → 识别技术栈
2. 创建目录：`~/.teamagent/`（全局）和 `{project}/.teamagent/`（项目级）
3. 激活知识包：按识别的技术栈复制对应JSONL到知识库
4. 导入已有规则：解析项目已有的CLAUDE.md/.cursorrules → 转为知识条目
5. 注册MCP Server：写入 `.claude/settings.json` 的 mcpServers 配置
6. 安装Hook：写入 `.claude/settings.json` 的 hooks 配置
7. 安装Skill命令：复制skill文件到 `.claude/commands/`
8. 更新CLAUDE.md：追加TeamAgent标记区块
9. 更新.gitignore：确保 `~/.teamagent/personal/` 不被提交

安装后生成的文件：
```
~/.teamagent/                  # 全局目录（不提交git）
├── config.json                # 全局配置（visibility mode等）
├── personal/                  # 个人知识库
│   └── knowledge.jsonl
└── sessions/                  # 会话轨迹记录

{project}/
├── .teamagent/                # 项目目录（git tracked）
│   ├── knowledge.jsonl        # 团队知识库
│   └── config.json            # 项目级配置
├── .claude/
│   ├── settings.json          # 已注册MCP+Hook
│   └── commands/              # 已安装skill命令
└── CLAUDE.md                  # 已追加TeamAgent区块
```

### 禁用与卸载

**临时禁用**（保留所有数据）：
```bash
npx teamagent disable
# 注释掉settings.json中的MCP和Hook配置
# CLAUDE.md中的TeamAgent区块保留但加上"已禁用"标记
```

**重新启用**：
```bash
npx teamagent enable
```

**彻底卸载**：
```bash
npx teamagent uninstall
# 移除settings.json中的MCP和Hook配置
# 移除CLAUDE.md中的TeamAgent区块
# 移除.claude/commands/中的TeamAgent skill
# 询问是否删除知识库数据（默认保留）
```

---

## 七、技术选型

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

## 八、功能范围

### Phase 1: 个人层核心

目标: 单个用户使用，AI不再犯同样的错误。Day 1即有价值。

功能:
1. 预置知识包 — 按技术栈预构建的经验库，随安装分发（解决冷启动）
2. 项目环境推断 — 扫描package.json/CLAUDE.md/配置文件，自动激活对应知识
3. 会话日志解析器 — 解析 ~/.claude/ 下的JSONL会话日志
4. 纠正时刻识别器 — 多信号融合检测（负面信号）
5. 成功模式捕获器 — 检测成功完成/表扬/重复使用（正面信号）
6. 知识提取引擎 — 调用Claude API结构化提取经验（avoidance+practice）
7. 本地知识库 — JSONL存储 + 关键词检索
8. PreToolUse/PostToolUse Hook — 拦截已知错误 + 记录执行结果
9. CLAUDE.md编译器 — 知识库→CLAUDE.md自动更新（见编译策略）
10. /pitfall命令 — 用户主动记录踩坑
11. /teamagent stats — 终端统计摘要

验证指标: 坑重现率下降; Day 1预置知识生效

### Phase 2: 实时防护

目标: MCP Server上线，智能体自主运行时也能实时守护。

功能:
1. MCP Server — check_pitfall / get_best_practice / report_correction / get_stats
2. Session Monitor — 旁路监控 + 模式匹配告警
3. Hook自动触发MCP — 解决长会话退化问题
4. 置信度自动校准 — 闭环追踪干预效果
5. 知识衰减引擎 — 过期知识自动降级
6. /teamagent override — 临时绕过规则
7. /teamagent rules — 管理活跃规则

验证指标: 首次正确率上升

### Phase 3: 团队层

目标: 团队知识共享，新人即老员工。

功能:
1. 团队知识库 — {project}/.teamagent/ git tracked
2. 审核门 — AI预审 + 冲突检测 + objective/subjective区分 + 人工确认
3. 回放验证器 — A/B对比验证知识有效性
4. 冲突仲裁 — 矛盾知识处理流程
5. 知识编译器多输出 — 同一知识→不同格式
6. /teamagent submit — 提交个人经验到团队
7. /teamagent review — 审核待入库知识
8. Knowledge Portal — HTML知识展示（仪表盘/浏览器/详情/实时流/周报）

验证指标: 跨用户避坑率

### Phase 4: 互联网层 + 多工具（远期）

功能:
1. 互联网知识源 — 主动爬取/分析外部最佳实践
2. Cursor适配 — .cursorrules编译器
3. Codex适配 — AGENTS.md编译器
4. 云端同步 — 替代git的实时同步
5. 知识市场 — 团队间共享知识库

---

## 九、评估框架

### 产品级指标

| 指标 | 定义 | 目标 |
|------|------|------|
| 坑重现率(PRR) | 同一坑在同一用户重复出现的概率 | 趋近于0 |
| 首次正确率(FTRR) | AI第一方案被接受的概率 | 持续上升 |
| 纠正密度(CD) | 每N个工具调用中纠正时刻数 | 持续下降 |
| 跨用户避坑率(CUPR) | A踩过的坑B成功避开的概率 | >80% |
| 进化周期(ECT) | 从踩坑到全团队受益的时间 | <24h |
| 知识精度(KP) | 经验证有效的知识比例 | >90% |

### 测试方法

**组件级测试:**
- 纠正时刻识别器: 200段标注对话 → 精确率>85%, 召回率>70%
- 知识提取引擎: 50条人工评分 → 均分>3.5/5, 分类准确率>80%
- Hook拦截器: 120条命令测试集 → 拦截准确率>95%, 误拦率<2%, 延迟<10ms
- Session Monitor: 构造行为轨迹 → 告警准确率>80%, 误报率<10%
- 知识编译器: 快照测试 → 输出与预期一致

**端到端闭环测试:**
- 场景A-E覆盖完整的"踩坑→学习→避坑"循环
- 含个人闭环(单用户纵向)和团队闭环(跨用户横向)

**A/B对比实验:**
- 20个"有坑的任务"，对照组(无TeamAgent) vs 实验组(有TeamAgent)
- 度量: 踩坑总数、对话轮数、工具调用次数、任务成功率

**纵向进化测试:**
- 模拟30天使用，绘制进化曲线(PRR/FTRR/CD随时间变化)

**真实用户验证:**
- 3-5个开发者使用1-2周，收集系统指标+主观评分+NPS

### 测试集

以"有坑的任务"为基础，每个任务包含已知坑、正确方案、评判标准、变体：
- V0(20个): 与Phase 1同步构建，自己踩过的坑
- V1(50个): Phase 2，互联网挖掘+构造
- V2(200个): Phase 3，含跨域迁移和多用户序列

---

## 十、风险分析与缓解

### 致命风险

**风险1：冷启动——Day 1无价值感**

问题: 知识库需要时间积累，但用户在第一天就评估工具。

缓解（Phase 1前置条件）:
1. 预置知识包: 按技术栈预构建50+条经验，随系统安装分发
2. 项目环境自动推断: 扫描package.json/CLAUDE.md等，自动激活对应知识并导入已有规则
3. 首次会话即有感知: 明确告知用户加载了多少条经验

**风险2：只学负面不学正面**

问题: 仅从纠正学习会导致纯"不要做X"列表。Trace2Skill研究证明成功+失败结合才有效(+21.50pp vs -21.83pp)。

缓解: 增加成功模式捕获(type: practice)，与避坑知识(type: avoidance)互补。

**风险3：个人偏好被当成团队最佳实践**

问题: "python→python3"是客观事实，"Zustand vs Redux"是主观偏好。不区分会导致团队抵触。

缓解: 知识分nature(objective/subjective)。subjective知识enforcement上限为warn，团队提交需≥2人支持，Portal标注为"团队约定"。

### 工程风险

| # | 风险 | 缓解措施 |
|---|------|---------|
| 1 | 会话日志格式依赖 | 解析层版本适配抽象，CC更新时回归测试 |
| 2 | 分析API成本 | 分级：本地模式匹配免费，LLM深度分析按需 |
| 3 | Hook延迟 | 检查<10ms（纯本地匹配），语义查询异步 |
| 4 | 反馈环振荡 | 标记受干预会话，设置单日知识新增上限 |
| 5 | 隐私顾虑 | 个人数据不上传，团队层仅共享结构化条目 |
| 6 | 误学习撤销 | 支持"撤回"操作并通知受影响成员 |
| 7 | 沉默错误盲区 | 互联网层弥补 + 回放验证发现 |
| 8 | 知识爆炸 | 衰减清理 + 合并相似 + scope知识上限 |

---

## 十一、竞品分析

| 产品/论文 | 与TeamAgent的差异 |
|----------|------------------|
| CLAUDE.md / .cursorrules | 人写人维护的静态规则，不自动进化 |
| gstack /learn | 本地JSONL存储，不支持团队共享，无语义搜索 |
| SkillClaw (2026.4) | 面向通用agent，非软件开发团队 |
| SkillX (2026.4) | 离线批量构建，非实时进化 |
| Trace2Skill (2026.3) | 单智能体优化，非跨用户 |
| Hermes Agent | 单用户框架，无团队协作原语 |
| Memento-Skills | 学术框架，非生产部署 |

TeamAgent的差异化: 面向软件开发团队 + 纠正时刻+成功模式双信号 + 五种帮助方式全覆盖 + 团队级集体进化 + 活的知识门户

---

## 十二、相关论文和资料

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
