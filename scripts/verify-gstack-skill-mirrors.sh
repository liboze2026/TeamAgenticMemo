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

expected_gstack_root_block() {
  local platform="$1"

  case "$platform" in
    claude)
      cat <<'EOF'
if [ -x "$_GSTACK_PROJECT_DIR/.claude/skills/gstack/bin/gstack-config" ]; then
  GSTACK_SKILLS_ROOT="$_GSTACK_PROJECT_DIR/.claude/skills/gstack"
elif [ -x "$_GSTACK_PROJECT_DIR/.codex/skills/gstack/bin/gstack-config" ]; then
  GSTACK_SKILLS_ROOT="$_GSTACK_PROJECT_DIR/.codex/skills/gstack"
elif [ -x "$HOME/.claude/skills/gstack/bin/gstack-config" ]; then
  GSTACK_SKILLS_ROOT="$HOME/.claude/skills/gstack"
elif [ -x "$HOME/.codex/skills/gstack/bin/gstack-config" ]; then
  GSTACK_SKILLS_ROOT="$HOME/.codex/skills/gstack"
else
  GSTACK_SKILLS_ROOT="$_GSTACK_PROJECT_DIR/.claude/skills/gstack"
fi
EOF
      ;;
    codex)
      cat <<'EOF'
if [ -x "$_GSTACK_PROJECT_DIR/.codex/skills/gstack/bin/gstack-config" ]; then
  GSTACK_SKILLS_ROOT="$_GSTACK_PROJECT_DIR/.codex/skills/gstack"
elif [ -x "$_GSTACK_PROJECT_DIR/.claude/skills/gstack/bin/gstack-config" ]; then
  GSTACK_SKILLS_ROOT="$_GSTACK_PROJECT_DIR/.claude/skills/gstack"
elif [ -x "$HOME/.codex/skills/gstack/bin/gstack-config" ]; then
  GSTACK_SKILLS_ROOT="$HOME/.codex/skills/gstack"
elif [ -x "$HOME/.claude/skills/gstack/bin/gstack-config" ]; then
  GSTACK_SKILLS_ROOT="$HOME/.claude/skills/gstack"
else
  GSTACK_SKILLS_ROOT="$_GSTACK_PROJECT_DIR/.codex/skills/gstack"
fi
EOF
      ;;
    *)
      fail "unknown gstack root block platform: $platform"
      ;;
  esac
}

extract_gstack_root_block() {
  local file="$1"

  awk '
    /^if \[ -x "\$_GSTACK_PROJECT_DIR\/\.(claude|codex)\/skills\/gstack\/bin\/gstack-config" \]; then$/ {
      in_block=1
    }
    in_block {
      print
      if ($0 == "fi") {
        exit
      }
    }
  ' "$file"
}

assert_gstack_root_block() {
  local platform="$1"
  local file="$2"
  local skill="$3"

  expected_gstack_root_block "$platform" > "$tmp/$platform-$skill.expected-block"
  extract_gstack_root_block "$file" > "$tmp/$platform-$skill.actual-block"

  diff -u "$tmp/$platform-$skill.expected-block" "$tmp/$platform-$skill.actual-block" \
    > "$tmp/$platform-$skill.block.diff" \
    || fail "$platform gstack root fallback block is wrong for $skill:
$(cat "$tmp/$platform-$skill.block.diff")"
}

normalize_gstack_root_block() {
  local file="$1"

  awk '
    /^if \[ -x "\$_GSTACK_PROJECT_DIR\/\.(claude|codex)\/skills\/gstack\/bin\/gstack-config" \]; then$/ {
      print "if [ -x \"$_GSTACK_PROJECT_DIR/.__PRIMARY__/skills/gstack/bin/gstack-config\" ]; then"
      print "  GSTACK_SKILLS_ROOT=\"$_GSTACK_PROJECT_DIR/.__PRIMARY__/skills/gstack\""
      print "elif [ -x \"$_GSTACK_PROJECT_DIR/.__SECONDARY__/skills/gstack/bin/gstack-config\" ]; then"
      print "  GSTACK_SKILLS_ROOT=\"$_GSTACK_PROJECT_DIR/.__SECONDARY__/skills/gstack\""
      print "elif [ -x \"$HOME/.__PRIMARY__/skills/gstack/bin/gstack-config\" ]; then"
      print "  GSTACK_SKILLS_ROOT=\"$HOME/.__PRIMARY__/skills/gstack\""
      print "elif [ -x \"$HOME/.__SECONDARY__/skills/gstack/bin/gstack-config\" ]; then"
      print "  GSTACK_SKILLS_ROOT=\"$HOME/.__SECONDARY__/skills/gstack\""
      print "else"
      print "  GSTACK_SKILLS_ROOT=\"$_GSTACK_PROJECT_DIR/.__PRIMARY__/skills/gstack\""
      print "fi"
      in_block=1
      next
    }
    in_block && /^fi$/ {
      in_block=0
      next
    }
    !in_block { print }
  ' "$file"
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
  assert_gstack_root_block claude ".claude/skills/$skill/SKILL.md" "$skill"
  assert_gstack_root_block codex ".codex/skills/$skill/SKILL.md" "$skill"

  normalize_gstack_root_block ".claude/skills/$skill/SKILL.md" > "$tmp/$skill.claude-normalized"
  normalize_gstack_root_block ".codex/skills/$skill/SKILL.md" > "$tmp/$skill.codex-normalized"

  diff -u "$tmp/$skill.claude-normalized" "$tmp/$skill.codex-normalized" \
    > "$tmp/$skill.normalized.diff" \
    || fail "SKILL.md content differs between mirrors outside gstack root fallback block: $skill
$(cat "$tmp/$skill.normalized.diff")"
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
