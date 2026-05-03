#!/usr/bin/env bash
# Deterministic verifier for project-level gstack skill mirrors.
#
# It checks the two project skill trees used by Claude Code and Codex:
#   .claude/skills/*
#   .codex/skills/*
#
# The check is intentionally local and sandbox-safe: it reads committed files
# only and never runs gstack, claudefast, codex, npm, or global installers.

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

fail() {
  echo "GSTACK-SKILL-MIRRORS: FAIL"
  echo "$1"
  exit 1
}

tmp="$(mktemp -d "${TMPDIR:-/tmp}/gstack-skill-mirrors.XXXXXX")"
trap 'rm -rf "$tmp"' EXIT

find .claude/skills -mindepth 2 -maxdepth 2 -name SKILL.md \
  | sed 's#^\.claude/skills/##; s#/SKILL.md$##' \
  | sort > "$tmp/claude-skills.txt"
find .codex/skills -mindepth 2 -maxdepth 2 -name SKILL.md \
  | sed 's#^\.codex/skills/##; s#/SKILL.md$##' \
  | sort > "$tmp/codex-skills.txt"

diff -u "$tmp/claude-skills.txt" "$tmp/codex-skills.txt" \
  > "$tmp/skills.diff" || fail "skill set differs between .claude and .codex mirrors:
$(cat "$tmp/skills.diff")"

find .claude/skills/gstack/bin -maxdepth 1 -type f -print \
  | sed 's#^\.claude/skills/gstack/bin/##' \
  | sort > "$tmp/claude-bin.txt"
find .codex/skills/gstack/bin -maxdepth 1 -type f -print \
  | sed 's#^\.codex/skills/gstack/bin/##' \
  | sort > "$tmp/codex-bin.txt"

diff -u "$tmp/claude-bin.txt" "$tmp/codex-bin.txt" \
  > "$tmp/bin.diff" || fail "gstack bin set differs between .claude and .codex mirrors:
$(cat "$tmp/bin.diff")"

while IFS= read -r bin; do
  cmp -s ".claude/skills/gstack/bin/$bin" ".codex/skills/gstack/bin/$bin" \
    || fail "gstack bin content differs: $bin"
done < "$tmp/claude-bin.txt"

for skill in $(cat "$tmp/claude-skills.txt"); do
  cmp -s ".claude/skills/$skill/SKILL.md" ".codex/skills/$skill/SKILL.md" \
    || fail "SKILL.md content differs between mirrors: $skill"
done

bad_codex_refs="$(
  rg -n '(\$\(|<\()((~|\$HOME)/\.claude|\.claude)/skills/gstack/bin/gstack-|^"?((~|\$HOME)/\.claude|\.claude)/skills/gstack/bin/gstack-' .codex/skills --glob 'SKILL.md' || true
)"
if [ -n "$bad_codex_refs" ]; then
  fail "Codex-visible skills still execute Claude-side gstack bins:
$bad_codex_refs"
fi

echo "GSTACK-SKILL-MIRRORS: PASS"
echo "skills=$(wc -l < "$tmp/claude-skills.txt" | tr -d ' ') bins=$(wc -l < "$tmp/claude-bin.txt" | tr -d ' ')"
