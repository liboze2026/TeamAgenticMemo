# TeamAgent E2E Bug Log

**Started:** 2026-04-27
**Baseline version:** 0.9.5 (commit cbd796a)
**Tester role:** real user via dev mode (tsx) in fresh `/tmp` dir

Conventions:
- `id`: `B-001` ascending, never reused
- `severity`: `P0` (blocks core flow), `P1` (major UX), `P2` (cosmetic / edge)
- `status`: `open` / `fixing` / `fixed-<commit>` / `wont-fix-<reason>`
- `repro`: minimal commands that reproduce on a fresh checkout

---

## Wave 1 — observed before testing

| id    | sev | command/area | symptom | repro | status |
|-------|-----|--------------|---------|-------|--------|
| B-001 | P2  | compile hook (CLAUDE.md write) | Atomic-rename leftovers `CLAUDE.md.tmp-<pid>-<ts>` accumulate when rename fails on Windows. Already gitignored, but the underlying write path should clean up on failure. | observe `CLAUDE.md.tmp-*` after multiple Stop hooks | open |
| B-002 | —   | (withdrawn) | tgz files local-only, .gitignore'd | n/a | wont-fix-not-a-bug |

## Wave 2 — self-tests (doctor / verify / e2e-evaluate)

Self-tests all reported green when run from monorepo root:
- `doctor` 8/8 ✓
- `verify` 5/5 ✓ (PRR=100, KP=5.00)
- `e2e-evaluate` `failures: []`

These cover synthetic / controlled scenarios. **They miss everything below.**

## Wave 3 — fresh-dir smoke (dev mode)

Setup: `cd /tmp/teamagent-smoke-bo6s1H` (empty), invoke `tsx <repo>/packages/cli/src/bin.ts <cmd>` with `cwd = /tmp/...`.

| id    | sev | command/area | symptom | repro | status |
|-------|-----|--------------|---------|-------|--------|
| B-003 | P1  | `bin.ts --version` | Outputs `unknown` in dev mode (tsx). Lookup required `pkg.bin.teamagent` which only exists on the published package, not on the monorepo root or workspace packages. | `pnpm teamagent --version` | fixed-pending-commit |
| B-004 | P1  | `doctor` sqlite-vec check | `sqlite-vec ✅` when run from monorepo root, `sqlite-vec ❌ 加载失败` when run from `/tmp` with the same `tsx <abs>/bin.ts doctor`. The require-resolution should be anchored at `import.meta.url`, not cwd — but observed behavior is cwd-dependent. Real users running `doctor` in their own project will see false-failure. | `cd /tmp/empty && tsx <repo>/packages/cli/src/bin.ts doctor` vs same from repo root | open |
| B-007 | P1  | `pitfall --non-interactive` in unininitialized dir | Writes a CLAUDE.md and adds an entry to the user-global DB even though the user has never run `teamagent init` in this directory. The `init` step is silently bypassed and ".teamagent" + CLAUDE.md materialize on first pitfall. Violates the README invariant that init must come first. | `cd /tmp/empty && tsx <repo>/packages/cli/src/bin.ts pitfall --non-interactive --trigger=X --wrong=Y --correct=Z --reason=R` | open |
| B-009 | P2  | unknown subcommand | `bin.ts unknown-command` prints `未知命令: unknown-command` and exits 0. Scripts piping `teamagent X && Y` won't notice the typo; standard practice is exit non-zero on unknown command. | `bin.ts foobar; echo $?` → `0` | open |
| B-010 | P2  | `wiki:list` on empty wiki db | Output is `No wiki entries found. Run \`teamagent wiki:pull\` first.` — English in an otherwise Chinese-localized CLI. | `bin.ts wiki:list` in fresh dir | open |

## Wave 4 — README walkthrough (pending)

Steps to test:
1. `npm install -g teamagent-0.9.5.tgz` (real tarball, not dev)
2. `cd <fresh project>`
3. `teamagent init`
4. Restart Claude Code (manual)
5. Trigger a session that produces a denial — verify learning loop

## Wave 5 — hook lifecycle simulation (pending)

Per advisor: synthetic transcript fixture → run `bin-stop.cjs` directly → verify
each step (analyze, calibrate, compile, harvest, scan-errors, narrative-scan)
on a corrupted/empty/non-UTF8 transcript.

## Wave 6 — edge cases (pending)

- empty knowledge.db
- missing .teamagent dir
- corrupted scan-cursor.json
- stale events.db schema
- `migrate-v6` on already-migrated db
- `migrate-v1-to-v2` on a v6 db (wrong-version migration)

---

## Status snapshot

- Found: **6 candidate bugs** (B-001, B-003, B-004, B-007, B-009, B-010)
- Fixed: **1** (B-003 — version lookup walks pnpm-workspace.yaml fallback)
- Self-tests covered: white-box only; gaps identified above
- Remaining waves: README walkthrough, hook lifecycle, edge cases (target ≥14 more bugs)
