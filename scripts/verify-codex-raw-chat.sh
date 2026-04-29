#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
OUT_DIR="${OUT_DIR:-$ROOT/scripts/out/codex-raw-chat-$(date +%Y%m%d-%H%M%S)}"
mkdir -p "$OUT_DIR"

PROMPT='Read the project instructions. If you can see a TeamAgent or TeamBrain managed block, answer exactly TEAMBRAIN_VISIBLE. Otherwise answer TEAMBRAIN_MISSING.'

codex exec \
  -C "$ROOT" \
  -m gpt-5.4-mini \
  -c 'model_reasoning_effort="medium"' \
  --json \
  -o "$OUT_DIR/last-message.txt" \
  "$PROMPT" \
  > "$OUT_DIR/codex-stream.jsonl"

grep -q "TEAMBRAIN_VISIBLE" "$OUT_DIR/last-message.txt"

echo "PASS codex-readable-agents-md"
echo "PASS codex-exec-teambrain-visible"
echo "PASS codex-raw-chat-behavior-probe"
echo "raw-chat: $OUT_DIR/codex-stream.jsonl"
echo "last-message: $OUT_DIR/last-message.txt"
