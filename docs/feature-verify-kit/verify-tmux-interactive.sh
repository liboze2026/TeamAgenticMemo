#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="$ROOT/docs/feature-verify-kit/runs"
SESSION="teamagent-feature-verify"
EXPORT_FILE="$OUT_DIR/tmux-export.md"
PANE_FILE="$OUT_DIR/tmux-pane.txt"
mkdir -p "$OUT_DIR"

PROMPT='EXPLAIN ONLY: how do we use claude stream json and tmux + interactive claude to verify if our features work ?'

rm -f "$EXPORT_FILE"
tmux kill-session -t "$SESSION" 2>/dev/null || true
tmux new-session -d -s "$SESSION" -x 220 -y 60 -c "$ROOT" "claudefast"
sleep 8

tmux send-keys -t "$SESSION" C-u
tmux send-keys -t "$SESSION" "$PROMPT"
tmux send-keys -t "$SESSION" C-m

# Wait for the LLM response to fully stream. Poll every 3s for up to 180s,
# break as soon as the bottom of the pane no longer shows "esc to interrupt"
# (claude's streaming-active marker) and no longer shows "queued messages".
for _i in $(seq 1 60); do
  sleep 3
  pane_tail=$(tmux capture-pane -t "$SESSION" -p | tail -8)
  if echo "$pane_tail" | grep -qE "esc to interrupt|queued messages"; then
    continue
  fi
  break
done

tmux send-keys -t "$SESSION" C-u
tmux send-keys -t "$SESSION" "/export $EXPORT_FILE"
tmux send-keys -t "$SESSION" C-m
# /export is a slash command and may also queue if claude is mid-turn; poll
# for the file to actually appear on disk before continuing.
for _j in $(seq 1 30); do
  sleep 2
  test -s "$EXPORT_FILE" && break
done

tmux capture-pane -t "$SESSION" -p > "$PANE_FILE"
tmux send-keys -t "$SESSION" "/exit" C-m
sleep 1
tmux kill-session -t "$SESSION" 2>/dev/null || true

test -s "$EXPORT_FILE"
echo "Wrote: $EXPORT_FILE"
echo "Wrote: $PANE_FILE"
