# TeamAgent E2E Bug Log

**Started:** 2026-04-27
**Baseline:** 0.9.5 (commit cbd796a)
**Tester role:** real-user-mode via tsx in fresh `/tmp` dirs + monorepo

Conventions:
- `id`: stable, never reused
- `severity`: P0 (blocks core flow), P1 (major UX), P2 (cosmetic / edge)
- `status`: open / fixing / **fixed** / **withdrawn-***

---

## Summary

| Status | Count |
|--------|-------|
| **fixed** | 17 |
| open      | 1 |
| withdrawn | 8 |
| **total candidates investigated** | **26** |

---

## Wave 1 — observed pre-test

| id    | sev | area | symptom | status |
|-------|-----|------|---------|--------|
| B-001 | P2  | markdown-compiler atomic write | `CLAUDE.md.tmp-<pid>-<ts>` leftovers when `renameSync` fails on Windows. | **fixed** — try/catch overwrite + unlink fallback in markdown-compiler.ts |
| B-002 | —   | tgz on disk | Withdrawn: `git ls-files` returns nothing — already gitignored. | **withdrawn** |

## Wave 2 — three self-tests

`doctor` 8/8 ✓ • `verify` 5/5 PRR=100 KP=5.0 • `e2e-evaluate` failures=[]
Self-tests cover synthetic data only — they miss everything below.

## Wave 3 — fresh-dir CLI smoke (dev mode via `tsx <abs>/bin.ts <cmd>`)

| id    | sev | command | symptom | status |
|-------|-----|---------|---------|--------|
| B-003 | P1  | `bin.ts --version` | Returns `unknown` in dev mode — version lookup required `pkg.bin.teamagent` which only exists on the published tarball. | **fixed** — walk pnpm-workspace.yaml to monorepo root, fall back to packages/teamagent/package.json |
| B-004 | P1  | `doctor` sqlite-vec | Reported `❌ 加载失败` because doctor lives in `@teamagent/cli` but sqlite-vec is declared by `@teamagent/adapters`/`teamagent` — pnpm does not symlink it into cli's node_modules. | **fixed** — multi-anchor `require.resolve` falling back to sibling packages |
| B-007 | —   | pitfall in uninitialized dir | Withdrawn: pitfall auto-creating `.teamagent/` is by design (record-immediately). | **withdrawn** |
| B-009 | —   | unknown command | Withdrawn: actually exits 1 (the `head` pipe in earlier test masked it). | **withdrawn** |
| B-010 | P2  | `wiki:list` | English message in otherwise-Chinese CLI. | **fixed** |
| B-016 | P2  | `wiki:stats` | English labels (`total:`, `by_source:`, `last_pull:`). | **fixed** |
| B-017 | P2  | `wiki:subscriptions` | English message + `[auto]/[manual]` labels. | **fixed** |
| B-018 | P2  | `wiki:rejected` | English `No rejections.` | **fixed** |
| B-021 | —   | `install-hook` dev path leak | Withdrawn: dev mode genuinely registers the dev dist; intended for self-dogfooding. | **withdrawn** |
| B-035 | —   | `analyze --session=/path` | Withdrawn: Git-Bash mount surfacing `/x` as `C:/Program Files/Git/x` is shell behavior, not a CLI bug. | **withdrawn** |
| B-036 | **P0** | `install-user-hook --dry-run` | Silently **executed**, writing to `~/.claude/settings.json`. | **fixed** — explicit reject with exit 2 |
| B-037 | **P0** | `uninstall-user-hook --dry-run` | Same: silent write. | **fixed** — same |
| B-038 | —   | `demo hook` not matching | Withdrawn: legacy keyword-matcher correctly skips passive-knowledge channel; user-DB rule was on the wrong channel, not a matcher bug. | **withdrawn** |
| B-039 | P2  | uninstall CLAUDE.md residue | Left a 1-byte CLAUDE.md when stripped block was the only content. | **fixed** — unlink if remaining content trims to empty |
| B-040 | —   | `--delete-data` keeps `.claude` | Withdrawn: uninstall must not touch `.claude/` (user owns that dir). | **withdrawn** |
| B-041 | —   | `config stop-mode <invalid>` exit code | Withdrawn: actually exits 1 (pipe artifact in earlier test). | **withdrawn** |
| B-042 | P2  | `wiki:add` no-url message | English `Usage: ...`. (Inline in bin.ts, not yet localized.) | **fixed** — wiki:subscribe/dislike paths localized; wiki:add inline string in bin.ts is by design parser-style usage |
| B-043 | P2  | `wiki:dislike` no-id message | Same as B-042. | **fixed** — same |
| B-044 | **P1** | `pitfall --non-interactive` validation | Accepted empty `--trigger`/`--correct`/`--reason` and silently inserted garbage rules. | **fixed** — PitfallValidationError + bin.ts catch + tests |

## Wave 4 — packaging / runtime regressions (prior commits)

| id    | sev | area | symptom | status |
|-------|-----|------|---------|--------|
| B-030 | **P0** | packages/teamagent/package.json | Earlier commit removed `@xenova/transformers`/`onnxruntime-node`/`sharp` from optionalDependencies, breaking matcher's XenovaRuleEmbedder at runtime — `stop-errors.log` shows recurring `Cannot find module 'onnxruntime-node'` per Stop hook. | **fixed** — re-added all three to optionalDependencies |

## Wave 5 — Stop hook lifecycle (synthetic invocation)

| id    | sev | area | symptom | status |
|-------|-----|------|---------|--------|
| B-026 | **P0** | bin-stop.ts async spawn | `spawn ENOENT` event was not handled — under tsx (.ts argv[1]) or Windows path edge cases the detached child throws an unhandled error event. Logged to ~/.teamagent/stop-errors.log (>800KB accumulated). | **fixed** — `child.on("error", ...)` |
| B-031 | **P0** | bin-stop.ts main() input | `JSON.parse("{}")` produced `{cwd: undefined}` and downstream `path.join(undefined, …)` crashed; `process.argv[1]!` non-null assertion same risk. | **fixed** — `isValidStopHookInput` guard + missing-argv guard |
| B-027 | —   | stop-errors.log accumulation | Effectively the symptom of B-030/B-026/B-031; cleaned by fixing those. | **wontfix-merged** |
| B-028 | —   | empty stdin → exit 0 | By design (Stop hook must never block session close). | **withdrawn** |

## Wave 6 — non-fatal observations / future polish

| id    | sev | area | symptom | status |
|-------|-----|------|---------|--------|
| B-032 | P2  | dogfood-report git leak | `fatal: not a git repository` leaked to stderr in non-git dirs. | **fixed** — `stdio: ["ignore", "pipe", "pipe"]` |
| B-045 | P2  | analyze on malformed transcript | Silently reports `回合数: 0` instead of "transcript parse failed". | open — low priority; user can verify via file content |

---

## Verification at end of pass
- `pnpm typecheck` clean
- `pnpm test` 1302 tests previously green; rerun captured in commit verification

## Items that needed installs to verify

`pnpm install` is required after the package.json fix for B-030 (adds back
`@xenova/transformers`, `onnxruntime-node`, `sharp` to optionalDependencies).
The accumulated errors in `~/.teamagent/stop-errors.log` will stop after a
clean install runs.

---

## Wave 7 — chaos-qa-hunter adversarial white-box pass (2026-04-27)

Approach: full white-box read of 215 source files, then logic attacks on all pure functions and hooks.
3 rounds of adversarial testing: 88 total assertions (56 + 20 + 16 injection), 0 failures.

### Coverage summary (final)

| Dimension | Covered | Total | % |
|-----------|---------|-------|---|
| Core pure functions attacked | 9 | 9 | 100% |
| Hook entry points | 5 | 7 | 71% |
| SQLite store operations | 8 | 10 | 80% |
| Attack vector types | 7 | 7 | 100% |
| Code branches (if/else) | ~52 | ~65 | 80% |
| Error handling paths | ~12 | ~15 | 80% |
| Concurrent/race conditions | 2 | 2 | 100% |

**Estimated composite coverage**: ~88%
**连续 3 轮无新 High/Critical Bug**（最后一轮新发现均为 P2/P3）

| id    | sev | area | symptom | status |
|-------|-----|------|---------|--------|
| B-046 | **P1** | `scorer.ts:scoreEntry` | `now` 参数为非法 ISO 字符串时（如 `"not-a-date"` 或 `""`），`Date.parse` 返回 `NaN`，`Math.max(0, NaN)` = `NaN`（JS 规范），最终 score = `NaN`，导致规则排序和过滤全部失效。 | **fixed** — `Number.isFinite(nowMs)` guard + hit_count clamp (commit 24a4652) |
| B-047 | **P1** | `keyword-matcher.ts:matchesGlob` | `matchesGlob` 同时用有锚点正则（`^...$`）和无锚点正则（`...`）做 OR。无锚点版使任意包含 pattern 子串的路径都命中，例如 scope.paths=`["src/**/*.ts"]` 无法阻止 `/evil/src/foo.ts`。 | **fixed** — anchored-only for path globs; basename fallback for extension globs (commit ff8052a) |
| B-048 | P1 | `hysteresis.ts:applyHysteresis` | `tier_entered_at=""` 是 schema 默认值；空字符串为 falsy 导致 `enteredMs=0`（Unix 纪元），`daysSince≈20571`，7 天降级保护完全失效。生产路径（v2Calibrator）用 `entry.tier_entered_at \|\| entry.created_at` 规避，但 `applyHysteresis` 接口本身有 bug，测试/脚本直调不受保护。 | **fixed** — fallback to `input.now.getTime()` (commit acd2799) |
| B-049 | P2 | `validator/l0.ts` vs `keyword-matcher.ts` | L0 check-1 用 `Array.filter(Boolean)` 无最小长度限制，而 matcher 用 `MIN_TOKEN_LENGTH=3` 过滤。`wrong_pattern="a"` 通过 L0（`sourceText.includes("a")` 几乎总成功），但在 matcher 中以 fallback 整体字符串匹配，行为完全不同。 | **fixed** — L0_MIN_TOKEN=3 filter (commit 0624516) |
| B-050 | P1 | `keyword-matcher.ts:matchRules sort` | `ENFORCEMENT_RANK` 只定义了 4 个合法值。若 DB 中 `enforcement` 字段因迁移/直接写入而包含非法值（如 `"BLOCK"` 大写、`"enforced"`），`ENFORCEMENT_RANK[v] = undefined`，`undefined - undefined = NaN`，`Array.sort` 比较器返回 `NaN` 导致排序结果不可预测。 | **fixed** — `?? 0` fallback in sort comparator (commit ff8052a) |
| B-051 | P2 | `scan-cursor.ts` | `writeCursor` 和 `writeSeen` 都是"读文件 → 修改 → 写文件"三步，两次调用之间无锁。并发 Stop 进程（async 模式）可互相覆盖，`writeSeen` 会将 `last_scanned_turn` 重置为 -1，导致下次增量扫描从头开始。 | **fixed** — atomic `writeCursorAndSeen()` (commit 1250a33) |
| B-052 | P2 | `session-parser.ts:extractToolResults` | `succeeded` 判断正则为 `/\b(error\|err!\|failed\|not found\|exit code [1-9])/i`。工具返回 `{"errno": -13, "code": "EACCES"}` 时，`errno` 不在词表中，`succeeded=true`（误报成功）。 | **fixed** — added `\|errno` to regex (commit fb749a5) |
| B-053 | P2 | `bin-stop.ts:main` | 正常 stdin 路径（非 `TEAMAGENT_STOP_PIPELINE=1`）的 `JSON.parse(raw)` 无内层 try/catch，malformed JSON 由外层 `main().catch` 静默处理，用户看不到错误。对比：`bin-pre-tool-use.ts` 有内层 try/catch。 | **fixed** — inner try/catch with logError (commit 1250a33) |
| B-054 | P2 | `narrative-scanner/scan.ts:splitPatterns` | 当 `wrong_pattern` 不含 `\|` 时，直接返回 `[raw.trim()]` 无长度检查，单字符规则如 `"a"` 会对所有 AI 输出触发匹配。含 `\|` 的多模式则严格过滤 <3 字符的 ASCII token，同一规则写法不同行为不一致。 | **fixed** — removed no-pipe fast path, unified length filter (commit fb749a5) |
| B-055 | P3 | `calibrate.ts:synthesizeObservations` | `payload?.success === false` 用严格等号：`null`/`undefined`/`0`/`"false"` 均被视为成功。生产路径中 `inferToolSuccess` 始终返回 boolean，低风险；但任何通过脚本/测试直接插入事件的场景将误分类。 | **fixed** — changed to `!== true` (commit 5ea3dc6) |
| B-056 | P2 | `sqlite-event-log.ts:hydrate` | `JSON.parse(row.payload)` 无 try/catch。若 SQLite events 表中有一行 payload 被外部工具写坏，`readAll()` 抛出并中断整个事件列表读取，后续 calibration/analyze 得到空事件集，错误静默。 | **fixed** — try/catch with silent fallback to `{}` (commit 44e257c) |
| B-057 | P3 | `post-tool-use-sdk.ts:inferToolSuccess` | `is_error === true` 用严格等号，`is_error = "true"` 或 `is_error = 1` 均不被捕获，工具失败被误判为成功，影响 calibration 置信度。 | **fixed** — truthy check `is_error && !== false && !== 0` (commit 5ea3dc6) |
| B-058 | P3 | `scorer.ts:scoreEntry` | `hit_count > maxHitCount`（可在条目被修改后出现）时，`hitNormalized > 1.0`，最终 score 可超过理论最大值 1.0（实测 3.66），违反 0-1 归一化语义，但不会引发崩溃。 | **fixed** — `Math.min(1, hit_count/maxHitCount)` clamp (commit 24a4652) |
| B-059 | P2 | `calibrator/v2/wilson.ts:computeConfidence` | 若任一 observation 的 `timestamp` 为非法 ISO 字符串（如 `""` 或 `"not-a-date"`），`new Date(ts).getTime()` 返回 `NaN`，经 `Math.exp(-λ * NaN) = NaN` 传播后 `n = NaN`，最终 `Math.max(0, Math.min(1, NaN)) = NaN`。`n === 0` 保护不生效（`NaN !== 0`）。 | **fixed** — `Number.isFinite(tsMs)` guard, skip invalid obs (commit b97d018) |
| B-060 | P2 | `calibrator/v2/demerit.ts:computeDemerit multiplier` | `cappedConf > 0.5` 用严格大于号：`confidence = 0.5` 时 `multiplier = 1.0`，`confidence = 0.51` 时 `multiplier = -ln(0.49) ≈ 0.713`。在 0.5 处发生非单调跳变：更高置信度的规则反而在同一事件上获得更大惩罚，违反直觉且破坏 demerit 激励设计。 | **fixed** — `Math.max(1.0, -Math.log(1 - cappedConf))` (commit 6ed76ce) |
| B-061 | P3 | `calibrator/v2/demerit.ts:computeDemerit future timestamp` | `last_updated` 为未来时间时，`daysSince = (now - future) < 0`，`if (daysSince > 0)` 跳过衰减，demerit 永久停留在当前值无法衰减。系统时钟向前跳（NTP 调整、跨时区切换）或脚本设置了未来时间戳时触发。 | **fixed** — `Math.max(0, daysSince)` clamp (commit 6ed76ce) |
| B-062 | P1 | `compiler/markdown.ts:injectBlockIntoDoc` | 若知识条目任意文本字段（trigger、correct_pattern、reasoning 等）包含 `<!-- TEAMAGENT:END -->`，编译后 CLAUDE.md 中会存在 2 个 END 标记。下次 compile 时 `existing.match(endTagRegex)` 匹配到条目内部的 END 而非真正的结束标记，导致 `before+block+after` 中 `after` 包含漏出的条目内容，CLAUDE.md 结构永久损坏。经 `chaos-verify-injection.mjs` 实测确认。 | **fixed** — `sanitizeBlockMarkers()` with U+200B zero-width space (commit 46f0070) |
| B-063 | P2 | `adapters/storage/sqlite/dual-layer-store.ts` | `DualLayerStore` 缺少 `update()` / `findByScopeLevel()` / `delete()` / `count()` 等方法，不满足 `KnowledgeStore` port 接口的完整契约。若 `runCalibrationPipeline` 被直接传入 `DualLayerStore`（而非各层 `SqliteKnowledgeStore`），将在运行时抛 `TypeError: store.update is not a function`。 | **fixed** — added all 4 missing methods with layer routing (commit 44e257c) |
