#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="$ROOT/docs/feature-verify-kit/runs"
mkdir -p "$OUT_DIR"

PROMPT='Read the section "## Canonical Feature TL;DR" in docs/系统展示.md. That section contains 7 bullet lines, each starting with one of these key names followed by ": " and a verbatim Chinese sentence: positioning, metrics, market_gap, delivered_vs_planned, hooks, knowledge_delivery, self_evolution. Return ONLY a JSON object whose 7 keys are exactly those names and whose values are the EXACT verbatim sentences from that section, copied byte-for-byte (same punctuation, same quotes, same digits). Do not paraphrase. Do not summarize. Do not add or remove any character. Do not include the leading "key: " prefix in the value.'
SCHEMA='{"type":"object","properties":{"positioning":{"type":"string","minLength":1},"metrics":{"type":"string","minLength":1},"market_gap":{"type":"string","minLength":1},"delivered_vs_planned":{"type":"string","minLength":1},"hooks":{"type":"string","minLength":1},"knowledge_delivery":{"type":"string","minLength":1},"self_evolution":{"type":"string","minLength":1}},"required":["positioning","metrics","market_gap","delivered_vs_planned","hooks","knowledge_delivery","self_evolution"],"additionalProperties":false}'

CLAUDEFAST_BIN="${CLAUDEFAST_BIN:-claudefast}"
if ! command -v "$CLAUDEFAST_BIN" >/dev/null 2>&1; then
  echo "FATAL: $CLAUDEFAST_BIN not found on PATH; set CLAUDEFAST_BIN=/path/to/claudefast" >&2
  exit 127
fi

"$CLAUDEFAST_BIN" -h > "$OUT_DIR/claudefast-help.txt" 2>&1 || true

"$CLAUDEFAST_BIN" -p --model haiku \
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
// Prefer .structured_output (set when --json-schema is used); fall back to
// parsing .result as JSON for older claude CLI versions.
let obj=null;
for(const line of lines){
  try{
    const j=JSON.parse(line);
    if(j && j.type==="result"){
      if(j.structured_output && typeof j.structured_output==="object"){
        obj=j.structured_output;
      } else if(typeof j.result==="string"){
        try{ obj=JSON.parse(j.result); }catch{}
      }
    }
  }catch{}
}
if(!obj) throw new Error("No structured_output or parseable result found in stream-json");
fs.writeFileSync(out, JSON.stringify(obj,null,2));
' "$OUT_DIR/claude-stream.jsonl" "$OUT_DIR/claude-features.json"

echo "Wrote: $OUT_DIR/claude-stream.jsonl"
echo "Wrote: $OUT_DIR/claude-features.json"
