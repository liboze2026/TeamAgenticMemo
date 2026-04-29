# canary skill verification

Three-way verification that the `canary` skill (copied verbatim from
`https://github.com/garrytan/gstack/blob/main/canary/`) is correctly
installed and discoverable by both project-level skill loaders.

```
                +-------------------------+
                |  .claude/skills/canary/ |
                |  .codex/skills/canary/  |
                +-----------+-------------+
                            |
        +-------------------+-------------------+
        |                   |                   |
        v                   v                   v
  [1] verify-       [2] verify-          [3] tmux-export.sh
  claudefast.sh     codex.sh             (claudefast TUI -> /export)
        |                   |                   |
        v                   v                   v
  runs/claudefast.json   runs/codex.json    exports/canary-session.txt
        \                  /                  (full transcript)
         \                /
          v              v
         hardmatch.sh  (jq -S deep-equal)
                |
                v
            PASS / FAIL
```

## Layout

| File | Purpose |
| ---- | ------- |
| `schema.json` | JSON Schema both verifiers must produce. |
| `prompt.tmpl` | Same registry-only prompt sent to both runtimes. |
| `verify-claudefast.sh` | Verifier 1: `claude --help`, then `claudefast -p --output-format json --json-schema ...`. |
| `verify-codex.sh` | Verifier 2: `codex --help`, then `codex debug prompt-input` registry assertion. |
| `hardmatch.sh` | Verifier 3a: `diff <(jq -S claudefast.json) <(jq -S codex.json)`. |
| `tmux-export.sh` | Verifier 3b: launches `claudefast` in tmux, asks about canary, runs `/export`. |
| `runs/` | Help dumps, verifier JSON outputs, and selected raw logs. |
| `exports/` | `/export` transcript + tmux pane snapshot. |

## How to re-run

```bash
# All from repo root.
zsh   docs/canary-verify/verify-claudefast.sh
bash  docs/canary-verify/verify-codex.sh
bash  docs/canary-verify/hardmatch.sh
bash  docs/canary-verify/tmux-export.sh
```

Each verifier first runs `MODULE --help` (claude or codex), so the harness
proves the binary is reachable before any model call.

## Pass criteria (all four MUST pass)

1. `runs/claudefast.json` validates against `schema.json`.
2. `runs/codex.json` satisfies the same `registered/name/status` contract.
3. `hardmatch.sh` exits 0 (canonical jq-sorted JSON is byte-equal).
4. `tmux-export.sh` produces `exports/canary-session.txt` containing
   registry-only JSON from `claudefast` interactively.

## Current canonical JSON (last run)

```json
{
  "name": "canary",
  "registered": true,
  "status": "found"
}
```

## Notes

- The model prompt deliberately forbids reading files and asks only about the
  in-memory registered skill list. The JSON contract avoids description text,
  because Claude Code and Codex may summarize registered descriptions
  differently even when the skill is loaded.
- `verify-codex.sh` does not invoke a model. It inspects Codex's generated
  prompt input for the project-level registry entry, so file reads by an agent
  cannot create a false pass.
- `verify-claudefast.sh` also writes `runs/claudefast.debug.log` and asserts
  the debug line `Loading skills from:` contains this repo's
  `.claude/skills` directory. That proves Claude Code's project skill loader
  looked at the project-level skill directory before the model answered. It
  also asserts the debug log mentions projectSettings skill `canary`, proving
  the specific project-level skill was registered.
- `claudefast` is a zsh function (defined in `~/.zshrc`) wrapping `claude`
  with a MiniMax-Anthropic-compatible profile. Verifier 1 uses
  `zsh -ic 'claudefast ...'` to load it. The wrapper's API token must
  never be written to disk; treat it as `[redacted]`.
- `verify-claudefast.sh` uses `python3` `JSONDecoder.raw_decode` to
  consume only the first JSON object from `.result`, ignoring any
  trailing noise from Claude Code stop hooks (e.g. a
  `<laziness-self-report>` block).
- `tmux-export.sh` acks `Enter to confirm` dialogs (workspace trust,
  external CLAUDE.md imports), waits for the model to return to idle
  (`? for shortcuts` and no `esc to interrupt`), then sends `/export`
  with an explicit destination path. Avoid `tmux send-keys -l` when
  typing into Claude Code TUI — bracketed paste makes Enter behave
  as newline rather than submit.
