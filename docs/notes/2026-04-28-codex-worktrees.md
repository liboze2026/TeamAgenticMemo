# Codex Worktrees And Project Skills

Codex and agent-owned task branches should live inside the project-local
worktree directory. This is the current project policy for all new worktrees:

```bash
.codex/worktrees/<task-name>
```

Use the same short name for the branch and directory when practical. Example:

```bash
git worktree add -b doc-garden-clean .codex/worktrees/doc-garden-clean
```

The parent checkout should locally ignore `.codex/worktrees/` through
`.git/info/exclude`, because nested worktrees are operational state, not project
source.

Do not create project worktrees in sibling directories, `.worktrees/`, or
`.claude/worktrees/`.

Project-level Codex skills must be tracked under:

```bash
.codex/skills/<skill-name>/SKILL.md
```

Do not put project skills in `.codex/agents/`. A tracked `.codex/skills/`
directory is included in every Git worktree, so the same skill works from the
main checkout and from `.codex/worktrees/<task-name>`.

Inspect active task checkouts:

```bash
git worktree list
```

Remove a completed or mistaken task checkout:

```bash
git worktree remove .codex/worktrees/<task-name>
git branch -D <task-name>
```
