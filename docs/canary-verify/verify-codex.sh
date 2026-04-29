#!/usr/bin/env bash
# Verifier 2/3: render Codex's model-visible prompt input and assert that the
# in-memory skill registry contains this project's "canary" skill. This avoids
# model/tool execution entirely, so the verifier cannot pass by reading
# .codex/skills/canary/SKILL.md directly.
#
# Pre-step (per spec): MODULE --help first.
# Output: docs/canary-verify/runs/codex.json (normalized JSON only)
#
# This script MUST be run from the repo root.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

OUT_DIR="docs/canary-verify/runs"
mkdir -p "$OUT_DIR"

SKILL_PATH="$REPO_ROOT/.codex/skills/canary/SKILL.md"
SCHEMA_PATH="$REPO_ROOT/docs/canary-verify/schema.json"
PROMPT_TMPL="$REPO_ROOT/docs/canary-verify/prompt.tmpl"

[[ -f "$SKILL_PATH"   ]] || { echo "FATAL: $SKILL_PATH missing" >&2; exit 1; }
[[ -f "$SCHEMA_PATH"  ]] || { echo "FATAL: $SCHEMA_PATH missing" >&2; exit 1; }
[[ -f "$PROMPT_TMPL"  ]] || { echo "FATAL: $PROMPT_TMPL missing" >&2; exit 1; }

command -v codex >/dev/null 2>&1 || { echo "FATAL: codex not in PATH" >&2; exit 1; }

echo "[1/3] MODULE --help (codex)"
codex --help >"$OUT_DIR/codex.help.txt" 2>&1
echo "       wrote $OUT_DIR/codex.help.txt ($(wc -l <"$OUT_DIR/codex.help.txt") lines)"

PROMPT="$(cat "$PROMPT_TMPL")"

echo "[2/3] codex debug prompt-input (no model tools)"
PROMPT_INPUT="$(mktemp)"
trap 'rm -f "$PROMPT_INPUT"' EXIT
codex debug prompt-input "$PROMPT" >"$PROMPT_INPUT" 2>"$OUT_DIR/codex.stderr.log"

echo "[3/3] assert registry entry and normalize"
EXTRACTED="$OUT_DIR/codex.json"
if jq -e --arg path "$SKILL_PATH" '
  any(
    .. | objects;
    .type? == "input_text"
    and (.text? | type == "string")
    and (.text | contains("### Available skills"))
    and (.text | contains("- canary:"))
    and (.text | contains($path))
  )
' "$PROMPT_INPUT" >/dev/null; then
  jq -n -S '{registered: true, name: "canary", status: "found"}' >"$EXTRACTED"
else
  jq -n -S '{registered: false, name: null, status: "missing"}' >"$EXTRACTED"
fi

jq -e '
  (.registered == true and .name == "canary" and .status == "found")
  or (.registered == false and .name == null and .status == "missing")
' "$EXTRACTED" >/dev/null

echo "OK -> $EXTRACTED"
echo
cat "$EXTRACTED"
