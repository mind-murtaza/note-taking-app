@AGENTS.md

# CLAUDE.md

Claude Code-specific operating rules for this repo. Product, stack, architecture, and API/DB conventions all live in AGENTS.md above — this file only covers how Claude Code should behave while working here.

## Permission Model

**Proceed without asking:**
- Reading/searching files; running `pnpm build`, `pnpm lint`, `pnpm test`, `pnpm --filter <pkg> dev` to verify work
- Editing files inside `backend/`, `frontend/`, `packages/shared/`, `e2e/`, `docs/` for the task at hand
- Creating a local git commit on the current feature branch

**Always ask first ([y/n]):**
- `git push`, `git push --force`, opening/merging a PR
- `pnpm prisma migrate dev|deploy`, or any command touching a real DB schema
- Deleting files, `git reset --hard`, `git clean`, `rm -rf`
- Adding/removing a dependency (`pnpm add`/`pnpm remove`) — confirm the exact pinned version first
- Editing CI config (`.github/workflows/`), Husky hooks, or `.env`/secrets
- Any change spanning more than one workspace package (`backend`, `frontend`, `packages/shared`) — confirm scope first

## Context Management

Clear/compact context at ~60k tokens in a working session. Before clearing, summarize what's done, what's left, and any open decisions into the todo list or a short handoff note — never lose task state to a clear.

## Thinking Depth

- Default effort for routine CRUD/route/service work that mirrors an existing pattern in the repo.
- Escalate to deeper thinking for: auth/refresh-token rotation, the version-snapshot-and-purge transaction, FTS query construction, and anything touching cross-user data isolation (FRS 1.6.2) — these are where a subtle bug becomes a security bug.
- Don't over-think mechanical work: renames, adding a field to an existing Zod schema, a new TanStack Query hook mirroring an existing one.

## Commit Message Format

Conventional Commits per AGENTS.md §13: `feat(scope): description AB#ticket` (also `fix`, `chore`, `test`, `refactor`). Scope = domain (`auth`, `note`, `tag`, `search`, `share`, `version`). One logical change per commit — don't bundle unrelated work.

## Branch Naming

`feature/{domain}/AB-{ticket}-{short-name}` per AGENTS.md §13, e.g. `feature/auth/AB-1002-login-endpoint`. Never commit directly to `main`.

## Quality Gates — Run in This Order

1. `pnpm build` — 0 errors/warnings
2. `pnpm lint --max-warnings 0`
3. `pnpm test`

Run all three before every commit and before declaring any task done. On a red step, fix it before moving to the next gate — don't push a failure downstream.

## Commands Requiring [y/n] Permission

- `git push*`, `gh pr create` / `gh pr merge`
- `pnpm prisma migrate *`, raw SQL against a real database
- `rm -rf`, `git reset --hard`, `git clean -f`, `git checkout -- .`
- `pnpm add` / `pnpm remove` (any dependency change)
- Writes to `.env`, `.github/workflows/`, or `.husky/`

Everything else needed to implement, test, and locally verify a task proceeds without asking.
