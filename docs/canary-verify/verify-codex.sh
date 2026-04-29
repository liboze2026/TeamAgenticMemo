#!/usr/bin/env bash
# Verifier 2/3: codex exec queries its own in-memory skill registry for a
# skill named "canary" and emits a normalized JSON matching
# docs/canary-verify/schema.json.
#
# Codex CLI does not expose a per-tool deny-list, so we rely on the prompt's
# explicit "do not read any file" instruction plus a read-only sandbox. The
# JSON schema deliberately omits any field that lives only in SKILL.md
# (version, allowed-tools, triggers): that way, even if a model cheats and
# opens the file, the answer it constructs is no stronger than what the
# registry already exposes — the structure cannot mask a discovery failure.
#
# Pre-step (per spec): MODULE --help first.
# Output: docs/canary-verify/runs/codex.json (extracted JSON only)
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

echo "[2/3] codex exec --json --output-schema <schema> -o <last>"
LAST="$OUT_DIR/codex.last.txt"
EVENTS="$OUT_DIR/codex.events.jsonl"

# `codex exec` reads stdin if attached; redirect from /dev/null to avoid hang.
codex exec \
  --json \
  --skip-git-repo-check \
  --sandbox read-only \
  --output-schema "$SCHEMA_PATH" \
  -o "$LAST" \
  "$PROMPT" \
  </dev/null \
  >"$EVENTS" 2>"$OUT_DIR/codex.stderr.log"

echo "[3/3] parse last message and normalize"
EXTRACTED="$OUT_DIR/codex.json"
jq -S '.' "$LAST" >"$EXTRACTED"

echo "OK -> $EXTRACTED"
echo
cat "$EXTRACTED"
