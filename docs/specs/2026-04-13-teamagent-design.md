# TeamAgent — 团队AI自进化引擎 设计文档

> 版本: 4.2 | 日期: 2026-04-14 | 状态: 设计完成，待实施

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

### 用户旅程：三个关键场景

**场景1：安装即刻**

`npx teamagent init` 完成后，CLAUDE.md 里多了一个 TeamAgent 区块，内容=几条元原则+从本项目 CLAUDE.md/.cursorrules 导入的团队约定。下一次对话时，AI 从第一句话起就在这些约定下工作。

**场景2：AI差点犯错但被挡住**

AI 准备执行 `npm install moment`。Hook 匹配到"用dayjs替代moment"规则，在工具调用之前拦截，AI 自动改用 dayjs。smart 模式下用户看到 `💡 TeamAgent: 已应用经验——优先使用dayjs而非moment（置信度0.88）`；silent 模式下完全无感。

**场景3：用户纠正AI，系统默默学习**

AI 建议用 REST API，用户说"我们这个场景用 GraphQL 更合适"。系统识别到纠正时刻，会话结束后在后台提取成一条知识条目。下次遇到同类触发时，AI 会直接用 GraphQL——**同一个人不需要纠正第二次**。

---

其他场景在相应章节中详述：智能体自主运行时的守护见"五、智能体模式支持"；提交到团队共享见"团队审核门"；查看统计和知识门户见"Knowledge Portal"。

---

## 三、核心概念

### Deviation（偏差/坑）

AI辅助开发过程中，任何导致结果偏离最佳实践的决策、行为或输出。不只是"错"才是坑，"不够好"也是坑。

### 可自审的坑分类体系

分类体系分为**固定层**（4个大类，不变）和**动态层**（子标签，系统自动发现和维护）。

#### 固定层：4个大类

四大类分别关注"错在哪个层面"：**C 代码层**（代码本身的问题）、**E 工程层**（工程方式的问题）、**S 策略层**（决策方向的问题）、**K 认知层**（知识缺口）。每个大类的子标签列表见下面"初始子标签"小节。

#### 动态层：子标签自审调整

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

#### 初始子标签

**代码层 C — 代码本身的问题**

| 子标签 | 定义 | 示例 |
|--------|------|------|
| syntax-error | 代码无法编译或运行 | 类型错误、语法错误、空引用 |
| api-hallucination | 调用不存在或已废弃的API/方法/参数 | 幻觉方法名、编造参数 |
| hidden-logic | 代码能跑但结果不对 | 竞态条件、边界缺失、静默丢数据 |
| code-quality | 代码能工作但不够好 | 重复代码、硬编码、命名混乱 |
| security | 引入安全漏洞 | SQL注入、XSS、硬编码密钥、不安全的依赖 |
| performance | 引入性能问题 | N+1查询、不必要重渲染、内存泄漏、bundle过大 |
| type-error | 类型系统相关错误 | 错误的类型断言、any滥用、泛型误用 |

**工程层 E — 工程方式的问题**

| 子标签 | 定义 | 示例 |
|--------|------|------|
| tech-choice | 选了能用但非最佳的技术 | 项目用Zustand，AI建议Redux |
| architecture | 架构方案可行但不够优 | 过早微服务化、错误分层 |
| workflow-order | 做事顺序或步骤不对 | 先写代码再设计、跳过测试 |
| config-blindspot | 不了解项目特定配置和约定 | ESLint规则、CI差异、环境变量缺失 |
| testing-strategy | 测试方案不当 | 该集成测试用了mock、缺少边界测试、测试覆盖不足 |
| dependency-mgmt | 依赖管理问题 | 依赖冲突、peer dependency、引入已知漏洞的版本 |
| deployment | 部署和DevOps问题 | Dockerfile配置错误、CI/CD管道问题、环境差异 |

**策略层 S — 决策方向的问题**

| 子标签 | 定义 | 示例 |
|--------|------|------|
| wrong-direction | 解决问题的整体思路不对 | 前端解决后端问题 |
| over-engineering | 做了不需要做的事 | 未被要求的功能、过度设计 |
| under-engineering | 该做的没做 | 缺少错误处理、安全验证、日志 |
| context-blindness | 无视项目/业务约束 | 忽略性能预算、合规要求 |

**认知层 K — 知识缺口**

| 子标签 | 定义 | 示例 |
|--------|------|------|
| version-lag | 使用过时模式 | Class Component代替Hooks |
| domain-gap | 缺少专业领域知识 | 不了解金融幂等要求 |
| team-tacit | 不了解团队约定和历史决策 | "我们试过X方案放弃了" |
| unknown-better-solution | 有更好方案但AI不知道 | 社区新库、成熟设计模式 |

### AI成长的五个维度

> **与 C/E/S/K 分类的关系**：C/E/S/K 是**坑的分类**，每条知识条目必有一个归属，用于组织和检索知识库。下面的五个维度是**AI能力成长的尺子**，不是知识条目的字段，用于衡量系统价值。两者关系：同一条 C 类知识（如某个 API 不存在）对 AI 而言可以服务于"事实记忆"或"避坑经验"两个维度——分类是"因"（知识怎么归档），维度是"果"（AI 因此变强在哪里）。



系统让AI在五个维度上持续成长，形成复合效应：

**维度一：事实记忆** — "记住具体的对和错"

环境事实（本机python3不是python）、API事实（Stripe方法不存在）、配置事实（ESLint用单引号）。这是最基础的成长，一周内AI就不再在明显事实上犯错。

**维度二：操作模式** — "记住怎么做某件事"

完成某类任务的步骤序列和工具组合。比如"在这个项目里创建新API endpoint的正确步骤是1→2→3→4→5"。AI做事的步骤顺序越来越对，不再跳步漏步。

**维度三：决策偏好** — "记住在这个团队里怎么选"

面对多个可行方案时，团队偏好什么。状态管理用Zustand、日期用dayjs、CSS用Tailwind。AI的建议越来越符合团队风格，code review修改越来越少。

**维度四：避坑经验** — "记住哪里有坑以及为什么"

不只是"别这样做"，而是理解坑的触发条件和根因。AI开始能预判风险并主动规避，而不是撞上去再修。

**维度五：元认知** — "知道自己不知道什么"

AI学会在关键决策点变得谨慎而非自信，会主动说"这个地方我不确定，让我先查一下"。

### 知识库演化的四种动力

知识不只是越来越多，而是越来越好。"进化"这个词在系统里有多个子概念，用不同词区分：

| 用词 | 对应机制 | 示例 |
|------|---------|------|
| **积累** | 新知识不断入库 | 用户纠正后系统提取、成功模式捕获、/pitfall 手动录入 |
| **置信度校准** | 好知识升级、坏知识淘汰 | 干预成功 confidence+0.05；override confidence-0.15 |
| **泛化** | 多条具体事实合并为通用模式 | 多条"某API不存在"→一条"该库版本过低" |
| **分类自审** | 标签体系自动重组 | 每50条新知识触发聚类分析，提议新标签/拆分标签 |

这四种动力共同驱动"产品愿景层面的 AI 进化"——**AI 进化 = AI 成长（5维度）× 知识库演化（4动力）**。

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
  "source": "preset|imported|accumulated|team-shared|internet",
  "conflict_with": []
}
```

字段说明:
- `scope.level`: **作用域**——这条知识对谁生效
  - `personal`=只对我自己（可以是跨项目的，也可以限定 paths/project）
  - `team`=本项目所有团队成员
  - `global`=所有项目（如"本机python指向python2"这类环境事实）
- `source`: **来源**——这条知识从哪来（不等同于 scope.level）
  - `preset`=随安装分发的元原则
  - `imported`=init 时从 CLAUDE.md/.cursorrules 导入
  - `accumulated`=从用户实际使用中积累
  - `team-shared`=经团队审核门后进入团队知识库
  - `internet`=Phase 4 的互联网知识（远期）
- `type`: avoidance(避坑型——"不要做X") | practice(实践型——"做Y效果好")
- `nature`: objective(客观事实，可验证) | subjective(主观偏好，多方案可行)
- `enforcement`: block(强制拦截,≥0.9) | warn(警告,0.7-0.9) | suggest(可查询,0.5-0.7) | passive(归档,<0.5)

**scope 和 source 的区别**：
- scope 决定"这条知识在什么时候生效"（运行时的匹配依据）
- source 决定"这条知识如何得来的"（治理/审计用途，比如撤销某次imported批次、分析哪种来源的知识最有效）
- 一条知识可以是 `scope.level=team, source=accumulated`（某人积累后提交到团队共享），也可以是 `scope.level=personal, source=imported`（从用户自己的.cursorrules导入但只对他自己生效）。

#### 知识条目示例

**示例1: 认知层 + subjective + practice（预置元原则）**
```json
{
  "id": "meta-004",
  "scope": {"level": "personal"},
  "category": "K", "tags": ["metacognition", "stop-and-investigate"],
  "type": "practice", "nature": "subjective",
  "trigger": "结果与预期不符、遇到意外文件/状态、工具报错",
  "wrong_pattern": "",
  "correct_pattern": "先停下来查清楚根因，理解了再动手；不要用删除/重建/--force绕过",
  "reasoning": "绕过式修复经常掩盖真问题，代价是后面以更严重的形式爆发",
  "confidence": 0.80, "enforcement": "suggest",
  "status": "active", "hit_count": 0, "success_count": 0, "override_count": 0,
  "evidence": {"correction_sessions": 0, "success_sessions": 0, "success_users": 0},
  "source": "preset"
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
  "source": "team-shared"
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
  "source": "team-shared"
}
```

### 知识编译（Knowledge Compilation）

将知识条目编译为目标AI工具可消费的格式。同一份知识，多种输出：
- CLAUDE.md（Claude Code）— 最基础的分发渠道
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

三层对应 `scope.level` 的三个取值：

| scope.level | 范围 | 审核 | 存储 |
|-------------|------|------|------|
| `personal` | 仅自己 | 无需审核 | `~/.teamagent/personal/knowledge.jsonl` |
| `team` | 本项目团队成员 | AI预审 + 人工确认 | `{project}/.teamagent/knowledge.jsonl`（git tracked）|
| `global` | 所有项目（通常是环境/本机事实） | 无需审核 | `~/.teamagent/global/knowledge.jsonl` |

Phase 4 会引入 **公共层**（source=internet 的条目池），作为所有 scope 的候选补充，不对应独立的 scope.level。

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

数据流：**用户使用 Claude Code → 采集 → 识别 → 分析 → 知识库 → 输出 → 同步**

```
用户 → Claude Code → [TeamAgent 六层]
                       1. 采集
                       2. 识别
                       3. 分析
                       4. 知识库
                       5. 输出（回流到 Claude Code）
                       6. 同步（跨用户）
```

| 层 | 职责 | 关键组件 |
|----|------|----------|
| **1. 采集（Collection）** | 从Claude Code各处取原始数据 | 会话日志读取 / Hook (PreToolUse/PostToolUse) / git diff / 终端输出 / `/pitfall` 主动录入 |
| **2. 识别（Detection）** | 从原始数据中识别有价值信号 | 纠正时刻识别器（负面，多信号融合）+ 成功模式捕获器（正面：一次成功/表扬/重复使用/多人采纳）|
| **3. 分析（Analysis）** | 把信号结构化成知识 | 归因分类器（C/E/S/K+标签）/ 知识提取器（avoidance+practice）/ 性质判定器（objective vs subjective）/ 冲突检测器 / 去重合并器（intervention_id 关联） |
| **4. 知识库（Knowledge Base）** | 存储、检索、生命周期管理 | JSONL存储（git可追踪）/ 分阶段检索 / 回放验证器 / 置信度校准 / 衰减 / 冲突仲裁队列。scope分三层：`personal` / `team` / `global` |
| **5. 输出（Delivery）** | 把知识还给 Claude Code | 五种帮助方式（见下表）+ 知识编译器（多目标格式）+ Knowledge Portal |
| **6. 同步（Sync）** | 跨用户共享 | MVP: git；远期: 云端。审核门把关 personal → team 的流转 |

**五种帮助方式**：

| # | 名称 | 含义 | 实现 | 时机 |
|---|------|------|------|------|
| ① | 工作习惯基线 | 会话开始时 AI 就带着经验 | CLAUDE.md 编译（元原则+导入规则+积累知识） | 每次会话开始 |
| ② | 实时顾问 | AI 做事前主动查询有没有坑 **（核心）** | MCP Server（`check_pitfall` / `get_best_practice` / `report_correction` / `get_stats`） | AI 思考时（主动调用 + Hook 自动触发） |
| ③ | 安全护栏 | AI 不会执行已知的错误操作 | Hook 脚本 PreToolUse / PostToolUse | 每次工具调用前。用户可 `/teamagent override` 临时绕过 |
| ④ | 全局视野 | AI 自己发现跑偏了 | Session Monitor + Prompt 动态注入 | 智能体自主运行时，每 5 次工具调用评估一次 |
| ⑤ | 持续学习 | AI 每天都比昨天聪明一点 | PostSession 分析 | 每次会话结束后 |

**Knowledge Portal** 三种形态：`/teamagent stats`（终端摘要，Phase 1 即可用）/ `/teamagent portal`（静态 HTML 快照）/ `/teamagent portal --live`（实时 HTTP + WebSocket，Phase 3）

**团队审核门**（Layer 6 的把关点）：AI 预审（格式/质量/冲突检测）→ objective 知识快速确认 / subjective 知识需 ≥2 人支持并标注"团队约定"→ 冲突知识显式标记供团队讨论 → 人工确认后 merge 到团队知识库。

### 五种帮助方式覆盖矩阵

每个子标签都至少被两种帮助方式覆盖。① 列表示"如果知识库里有这类知识，会通过 CLAUDE.md 编译进来"，并不代表系统预装了这类知识——预装仅限元原则（见最后两行）。

| 大类 | 子标签 | ① 工作习惯 | ② 实时顾问 | ③ 安全护栏 | ④ 全局视野 | ⑤ 持续学习 |
|------|--------|:---------:|:---------:|:---------:|:---------:|:---------:|
| C | syntax-error      |   | ✓ |   |   | ✓ |
| C | api-hallucination | ✓ | ✓ |   |   | ✓ |
| C | hidden-logic      | ✓ |   |   | ✓ | ✓ |
| C | security          | ✓ | ✓ | ✓ |   | ✓ |
| C | performance       | ✓ |   |   | ✓ | ✓ |
| E | tech-choice       | ✓ |   |   | ✓ | ✓ |
| E | architecture      | ✓ |   |   | ✓ | ✓ |
| E | workflow-order    | ✓ | ✓ | ✓ |   | ✓ |
| E | config-blindspot  | ✓ | ✓ |   |   | ✓ |
| E | testing-strategy  | ✓ |   |   | ✓ | ✓ |
| E | deployment        | ✓ | ✓ |   |   | ✓ |
| S | wrong-direction   | ✓ |   |   | ✓ | ✓ |
| S | over-engineering  | ✓ |   |   | ✓ | ✓ |
| S | under-engineering | ✓ |   |   | ✓ | ✓ |
| S | context-blindness | ✓ |   |   | ✓ | ✓ |
| K | version-lag       | ✓ | ✓ |   |   | ✓ |
| K | domain-gap        | ✓ |   |   |   | ✓ |
| K | team-tacit        | ✓ |   |   |   | ✓ |
| K | unknown-better    | ✓ |   |   |   | ✓ |
| **K** | **metacognition**（元原则） | **✓** | ✓ |   |   | ✓ |
| **S** | **workflow-principles**（元原则） | **✓** | ✓ |   |   | ✓ |

子标签会随分类自审动态扩展，新标签自动继承所属大类的覆盖模式。

### 规则的作用域(Scope)

```
global —— ~/.teamagent/global/knowledge.jsonl
  适用于所有项目。例: 本机用python3不是python

  team —— {project}/.teamagent/knowledge.jsonl （git tracked）
    适用于本项目所有成员。例: 本项目用Zustand不用Redux

    personal —— ~/.teamagent/personal/knowledge.jsonl
      仅自己。可用 scope.project 进一步限定为"只在某项目里生效"。
      例: 我的venv路径是xxx（某项目内个人）
```

匹配时优先级: `personal > team > global`

规则可限定 `scope.project`、`scope.paths`（目录）、`scope.file_types`（文件类型）、`scope.branches`（分支），实现精确生效范围。

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
├── knowledge-packs/           # 预置知识包（仅元原则，不做语法级预置）
│   └── meta-principles.jsonl  # 跨项目通用的工作流/元认知原则
│
└── cli/                       # 安装/初始化CLI
    └── init.ts
```

### 安装流程（npx teamagent init）

执行后系统做的事：

1. 扫描项目：读package.json/tsconfig/CLAUDE.md等 → 识别技术栈
2. 创建目录：`~/.teamagent/`（全局）和 `{project}/.teamagent/`（项目级）
3. 加载预置元原则：复制 meta-principles.jsonl 到知识库（不区分技术栈——语法级知识不预置，等从用户使用中学习）
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
├── global/                    # scope.level=global 的知识
│   └── knowledge.jsonl
├── personal/                  # scope.level=personal 的知识
│   └── knowledge.jsonl
└── sessions/                  # 会话轨迹记录

{project}/
├── .teamagent/                # 项目目录（git tracked）
│   ├── knowledge.jsonl        # scope.level=team 的知识
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
1. 预置元原则知识包 — 仅含跨项目通用的工作流/元认知原则（4-8条），不做语法级预置
2. 项目环境推断 — 扫描package.json/CLAUDE.md/配置文件，识别技术栈（仅用于日志和未来的互联网检索）
2.5. 导入已有规则 — 解析项目已有的CLAUDE.md/.cursorrules转为知识条目（冷启动主要靠这里）
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

**纵向成长测试:**
- 模拟30天使用，绘制AI成长曲线(PRR/FTRR/CD随时间变化)

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
1. 预置元原则: 4-8条跨项目通用的工作流/元认知原则（故意不按技术栈预置语法级知识——那些AI已经知道，且覆盖率极低）
2. 导入已有规则: 扫描项目CLAUDE.md/.cursorrules，把团队已有约定转为结构化知识（这是冷启动的主要来源）
3. 首次会话即有感知: 明确告知用户加载了多少条知识，哪些来自已有规则

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

## 十一、相关工作与差异

| 工作 | 类型 | 核心 | 与 TeamAgent 的差异 |
|------|------|------|--------------------|
| CLAUDE.md / .cursorrules | 产品 | 手写AI规则文件 | 人写人维护的静态规则，不自动积累不自动校准 |
| gstack `/learn` | 产品 | 本地JSONL经验库 | 单用户本地，无团队共享、无语义搜索、无校准机制 |
| [SkillClaw](https://arxiv.org/abs/2604.08377) (2026.4) | 论文 | 多用户集体技能进化 | 面向通用agent，非软件开发团队；无纠正时刻捕获 |
| [SkillX](https://arxiv.org/abs/2604.04804) (2026.4) | 论文 | 自动构建三层技能知识库 | 离线批量构建，非实时；无 Hook/MCP 实时防护 |
| [Trace2Skill](https://arxiv.org/abs/2603.25158) (2026.3) | 论文 | 轨迹蒸馏为可迁移技能 | 单智能体优化，非跨用户；证明了双信号（成功+失败）+21.50pp |
| [SkillRL](https://arxiv.org/abs/2602.08234) (2026.2) | 论文 | 递归技能强化学习 | 强化学习框架，非产品级 |
| [SWE-Bench-CL](https://arxiv.org/abs/2507.00014) (2025) | 基准 | 持续学习编码基准 | 用作评估参考，非产品 |
| [Hermes Agent](https://yuv.ai/blog/hermes-agent) | 产品 | 四层记忆自改进AI | 单用户框架，无团队协作原语 |
| Memento-Skills | 论文 | 技能记忆框架 | 学术框架，非生产部署 |

**TeamAgent 的差异化定位**：面向软件开发团队 + 纠正时刻 + 成功模式双信号 + 五种帮助方式全覆盖 + 团队级集体进化 + 活的知识门户。

**其他参考资料**：
- [Encoding Team Standards](https://martinfowler.com/articles/reduce-friction-ai/encoding-team-standards.html) (2026.3) — 团队标准编码
- [Self-Improving Coding Agents](https://addyosmani.com/blog/self-improving-agents/) (2026.1) — 自改进编码智能体综述
- [API Misuse in LLMs](https://arxiv.org/html/2503.22821) — LLM 的 API 误用分类（用于 C/api-hallucination 子标签设计）
- [LLM Code Hallucinations](https://arxiv.org/html/2409.20550v1) — 代码幻觉研究
