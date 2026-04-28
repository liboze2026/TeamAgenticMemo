---
name: doc-gardener
description: Use when project markdown needs size control, index splitting, or doc garden verification. Trigger when a non-ignored .md file is over 200 lines, when the user asks to split large docs into summary-style indexes, or when docs must be verified with claudefast queries.
---

# Doc Gardener

Keep project documentation navigable, compact, and verifiable. Transform
oversized markdown files into summary-style indexes that point to smaller detail
files, while preserving enough information for future agents to answer concrete
questions.

## Project-Level Placement

This skill must stay at `.codex/skills/doc-gardener/SKILL.md`. Do not move it to
`.codex/agents/` or a user-level skills directory. Keeping it tracked inside the
repo makes the skill available in every Git worktree created from this project.

## Core Rules

1. Read `.claude/DOC_GARDEN_IGNORE.md` first. Treat each non-empty, non-comment
   line as an ignore glob.
2. If the ignore file is missing, continue with an empty ignore list and report
   that fact.
3. Only act on markdown files not matched by the ignore list.
4. Any non-ignored `.md` file over 200 lines is oversized.
5. Every non-ignored markdown file you leave behind must be under 200 lines.
6. Do not delete information. Move details into linked child files instead.
7. Keep the original large file path as a summary-style index when practical.
8. Preserve user edits and unrelated changes. Do not revert files you did not
   intentionally modify.

## Workflow

1. Inventory markdown files with line counts.
2. Apply `.claude/DOC_GARDEN_IGNORE.md` globs.
3. Select oversized non-ignored files.
4. For each file, identify its major topics, decisions, evidence, commands,
   risks, and open questions.
5. Rewrite the original file into a concise index with purpose, reading map,
   child links, key decisions, and verification queries.
6. Move detailed sections into child markdown files near the original file, using
   clear names.
7. Re-run line counts and continue splitting until all non-ignored markdown is
   below 200 lines.
8. For each original oversized file, compute `N = original_line_count // 200 + 2`.
9. Run at least `N` verification queries with `claudefast -p "{query}"`.
10. Query coverage must include global navigation, each new index, and important
    details moved into child files.
11. Keep editing until the query answers are correct enough for the project rules.

## Quality Standards

- Index files must be useful entry points, not vague summaries.
- Child docs must be linked from an index and should each have a narrow topic.
- Prefer tables or short sections when they improve scanning.
- Keep names stable and descriptive.
- Do not create orphan markdown files.
- Do not hide important constraints in deep files without an index pointer.

## Output

Return files scanned and ignored, oversized files found, files changed, final
line-count proof, verification queries with pass/fail results, and remaining
risks or follow-up work.
