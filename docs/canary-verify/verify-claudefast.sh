#!/usr/bin/env zsh
# Verifier 1/3: claudefast (claude code, MiniMax fast profile) reads
# .claude/skills/canary/SKILL.md frontmatter and emits a normalized JSON
# matching docs/canary-verify/schema.json.
#
# Pre-step (per spec): MODULE --help first.
# Output: docs/canary-verify/runs/claudefast.json (extracted JSON only)
#
# This script MUST be run from the repo root.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

OUT_DIR="docs/canary-verify/runs"
mkdir -p "$OUT_DIR"

SKILL_PATH="$REPO_ROOT/.claude/skills/canary/SKILL.md"
SCHEMA_PATH="$REPO_ROOT/docs/canary-verify/schema.json"
PROMPT_TMPL="$REPO_ROOT/docs/canary-verify/prompt.tmpl"

[[ -f "$SKILL_PATH"   ]] || { echo "FATAL: $SKILL_PATH missing" >&2; exit 1; }
[[ -f "$SCHEMA_PATH"  ]] || { echo "FATAL: $SCHEMA_PATH missing" >&2; exit 1; }
[[ -f "$PROMPT_TMPL"  ]] || { echo "FATAL: $PROMPT_TMPL missing" >&2; exit 1; }

# Load claudefast function from interactive zsh.
emulate -L zsh
setopt local_options
source "${ZDOTDIR:-$HOME}/.zshrc" 2>/dev/null || true
type claudefast >/dev/null 2>&1 || { echo "FATAL: claudefast not loaded" >&2; exit 1; }

echo "[1/3] MODULE --help (claude)"
claude --help >"$OUT_DIR/claudefast.help.txt" 2>&1
echo "       wrote $OUT_DIR/claudefast.help.txt ($(wc -l <"$OUT_DIR/claudefast.help.txt") lines)"

PROMPT="$(sed "s#__SKILL_PATH__#$SKILL_PATH#" "$PROMPT_TMPL")"
SCHEMA_JSON="$(cat "$SCHEMA_PATH")"

echo "[2/3] claudefast -p --output-format json --json-schema <schema>"
RAW="$OUT_DIR/claudefast.raw.json"
claudefast -p \
  --output-format json \
  --json-schema "$SCHEMA_JSON" \
  --permission-mode acceptEdits \
  "$PROMPT" >"$RAW" 2>"$OUT_DIR/claudefast.stderr.log"

echo "[3/3] extract .result, take first JSON object only, normalize"
EXTRACTED="$OUT_DIR/claudefast.json"
# .result may include trailing noise from Claude Code's stop hook
# (e.g. a <laziness-self-report> block). Use raw_decode to consume
# only the first JSON value and ignore everything after.
jq -e -r '.result' "$RAW" \
  | python3 -c '
import sys, json
text = sys.stdin.read().strip()
obj, _ = json.JSONDecoder().raw_decode(text)
print(json.dumps(obj, sort_keys=True, indent=2))
' >"$EXTRACTED"

echo "OK -> $EXTRACTED"
echo
cat "$EXTRACTED"
