#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="$ROOT/docs/feature-verify-kit/runs"
mkdir -p "$OUT_DIR"

PROMPT='Read docs/系统展示.md and docs/feature-verification.md. Return ONLY JSON with keys: positioning, metrics, market_gap, delivered_vs_planned, hooks, knowledge_delivery, self_evolution. Each key must be a non-empty string.'
SCHEMA='{"type":"object","properties":{"positioning":{"type":"string","minLength":1},"metrics":{"type":"string","minLength":1},"market_gap":{"type":"string","minLength":1},"delivered_vs_planned":{"type":"string","minLength":1},"hooks":{"type":"string","minLength":1},"knowledge_delivery":{"type":"string","minLength":1},"self_evolution":{"type":"string","minLength":1}},"required":["positioning","metrics","market_gap","delivered_vs_planned","hooks","knowledge_delivery","self_evolution"],"additionalProperties":false}'

claude -h > "$OUT_DIR/claude-help.txt" 2>&1 || true

claude -p --bypass --model haiku \
  --output-format stream-json \
  --include-hook-events \
  --include-partial-messages \
  --verbose \
  --permission-mode acceptEdits \
  --json-schema "$SCHEMA" \
  "$PROMPT" \
  > "$OUT_DIR/claude-stream.jsonl" \
  2> "$OUT_DIR/claude-stream.stderr.log"

node -e '
const fs=require("fs");
const p=process.argv[1];
const out=process.argv[2];
const lines=fs.readFileSync(p,"utf8").split(/\n+/).filter(Boolean);
let last="";
for(const line of lines){
  try{const j=JSON.parse(line); if(typeof j.result==="string") last=j.result;}
  catch{}
}
if(!last) throw new Error("No result field found in stream-json");
const obj=JSON.parse(last);
fs.writeFileSync(out, JSON.stringify(obj,null,2));
' "$OUT_DIR/claude-stream.jsonl" "$OUT_DIR/claude-features.json"

echo "Wrote: $OUT_DIR/claude-stream.jsonl"
echo "Wrote: $OUT_DIR/claude-features.json"
