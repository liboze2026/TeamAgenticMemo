#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="$ROOT/docs/feature-verify-kit/runs"
SESSION="teamagent-feature-verify"
EXPORT_FILE="$OUT_DIR/tmux-export.md"
PANE_FILE="$OUT_DIR/tmux-pane.txt"
mkdir -p "$OUT_DIR"

PROMPT='EXPLAIN ONLY: how do we use claude stream json and tmux + interactive claude to verify if our features work ?'

tmux kill-session -t "$SESSION" 2>/dev/null || true
tmux new-session -d -s "$SESSION" -x 220 -y 60 -c "$ROOT" "claudefast"
sleep 5

tmux send-keys -t "$SESSION" C-u
tmux send-keys -t "$SESSION" "$PROMPT"
tmux send-keys -t "$SESSION" C-m

sleep 25

tmux send-keys -t "$SESSION" C-u
tmux send-keys -t "$SESSION" "/export $EXPORT_FILE"
tmux send-keys -t "$SESSION" C-m
sleep 5

tmux capture-pane -t "$SESSION" -p > "$PANE_FILE"
tmux send-keys -t "$SESSION" "/exit" C-m
sleep 1
tmux kill-session -t "$SESSION" 2>/dev/null || true

test -s "$EXPORT_FILE"
echo "Wrote: $EXPORT_FILE"
echo "Wrote: $PANE_FILE"
