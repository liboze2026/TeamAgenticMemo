#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="$ROOT/docs/feature-verify-kit/runs"
A="$OUT_DIR/claude-features.json"
B="$ROOT/fixtures/expected-product-features.json"

jq -S . "$A" > "$OUT_DIR/claude-features.sorted.json"
jq -S . "$B" > "$OUT_DIR/expected-features.sorted.json"

diff -u "$OUT_DIR/expected-features.sorted.json" "$OUT_DIR/claude-features.sorted.json"
echo "PASS: feature JSON hard-match"
