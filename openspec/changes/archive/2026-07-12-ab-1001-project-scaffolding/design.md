## Context

The repo is greenfield: only `docs/` and `.claude/` exist, plus placeholder `CLAUDE.md` files in `backend/`, `frontend/`, `packages/shared/`. AB-1001 stands up the pnpm monorepo and the full quality-gate toolchain so `pnpm build → lint → test` run green on an empty tree and every later ticket (AB-1002+) inherits an enforced baseline. The tech-stack majors are fixed by the assignment (SDS §1); exact patch versions are deliberately left to implementation time (ADR-006). This is a cross-cutting change touching every package plus root config, CI, and local infra — so it warrants a design doc even though it carries no functional requirement.

Constraints that drive the decisions below:
- Layering (SDS §2): `packages/shared` is the single source of Zod schemas/types; `backend` = route → service → repository → Prisma; `frontend` = React 19 + Vite. Scaffolding must make those import paths work, not implement them.
- Every dependency pinned exact; `pnpm audit --audit-level=high` must be clean (AC1, AC8).
- Node 22, pnpm, PostgreSQL 16 (SDS §1).

## Goals / Non-Goals

**Goals:**
- A working pnpm workspace with four packages that build, lint, format, and test green while empty.
- Strict TypeScript proven active (a deliberate type error fails the build), not just configured.
- `@app/shared` importable from `backend` and `frontend` via the workspace protocol.
- All quality tooling wired and enforced: ESLint (flat) + Prettier, Knip, Husky + lint-staged + Commitlint + Gitleaks, Vitest + v8 coverage.
- Bare Prisma that `prisma generate`s; local Postgres 16 with dev + test databases via docker-compose.
- CI (install → build → lint → format:check → test → gitleaks) and Dependabot (npm + github-actions).
- Exact version pins recorded in each `package.json` and a committed `pnpm-lock.yaml`.

**Non-Goals:**
- No domain logic, no Zod domain schemas, no Prisma models, no routes/services/components (AB-1002+).
- No deployment/CD, no application Dockerfiles (docker-compose is local Postgres only) — SDS §10.4.
- No coverage enforcement gate wired into CI to fail below 80% at this stage; AB-1001 wires coverage *reporting*. The ≥80%-on-new-code gate is applied per feature ticket (SDS §7).

## Decisions

### D1 — Version pinning: fix majors now, resolve exact patches at implementation (ADR-006)
Majors are fixed by SDS §1 (React 19, Express 5, Node 22, PostgreSQL 16, Prisma current stable, TypeScript 5.x, Vite, Vitest, Zod, TanStack Query, Zustand, TipTap, shadcn/Radix, Sonner, lucide-react). Exact patch versions are resolved during implementation, pinned exact in `package.json`, and frozen by committing `pnpm-lock.yaml`. Gate: `pnpm audit --audit-level=high` must report 0 high/critical before the ticket is done; if a chosen version has an advisory, bump to the nearest clean patch and re-pin.
- *Why:* prevents stale/vulnerable pins baked into a spec; keeps the audit a verified fact, not an assumption.
- *Alternative rejected:* hardcoding exact versions in this doc — goes stale immediately and can't be audit-verified ahead of install.

### D2 — Package identity & resolution: `@app/*` over the workspace protocol
Packages are named `@app/shared`, `@app/backend`, `@app/frontend`, `@app/e2e`. `backend` and `frontend` depend on `@app/shared` via `"@app/shared": "workspace:*"`. `packages/shared` exposes types/schemas through its `package.json` `exports` map; consumers import from `@app/shared`.
- *Why:* `@app/shared` is the exact alias AGENTS.md §12 and SDS §2 already reference. `workspace:*` guarantees the local package is used and rewrites to the pinned version on publish (irrelevant here, but correct).
- *Alternative rejected:* TS path aliases only (`paths` in tsconfig) — works for `tsc` but not for Vite/Vitest/node resolution without extra plugins; the workspace protocol is resolver-agnostic.

### D3 — TypeScript: one strict `tsconfig.base.json`, each package extends
Root `tsconfig.base.json` sets `strict: true` (plus `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`) and shared compiler options. Each package has a `tsconfig.json` that `extends` the base and sets its own `rootDir`/`outDir`/`moduleResolution`. `backend` uses `NodeNext`; `frontend` uses `Bundler` (Vite). Strict-mode proof (AC10) is demonstrated during implementation by temporarily introducing a type error and confirming `pnpm build` fails, then reverting.
- *Why:* single source of strictness; per-package overrides only where the runtime differs.
- *Alternative rejected:* TS project references (`composite`) — extra build-order complexity YAGNI for four small packages; revisit only if build times demand it.

### D4 — ESLint flat config at the root, Prettier for formatting
A single root `eslint.config.js` (flat config) composes `typescript-eslint` recommended-type-checked rules for all TS, React + react-hooks rules scoped to `frontend/**`, and `eslint-config-prettier` **last** to disable format rules. Prettier owns formatting (`.prettierrc` + `.prettierignore`); `pnpm format:check` runs `prettier --check`. `pnpm lint` runs `eslint . --max-warnings 0`.
- *Why:* flat config is the current ESLint standard; one config avoids per-package drift; Prettier/ESLint split avoids rule conflicts.
- *Alternative rejected:* per-package `.eslintrc` — duplicates rules, drifts, contradicts the DRY rule in the package CLAUDE.md files.

### D5 — Build per package, orchestrated by root `pnpm build`
Root `build` runs `pnpm -r --stream build` (recursive). Per package: `shared` and `backend` build with `tsc`; `frontend` builds with `vite build` (+ `tsc --noEmit` typecheck); `e2e` typechecks with `tsc --noEmit` (no emit — Playwright runs `.ts` directly). Must be 0 errors/warnings (AC2).
- *Why:* each package builds with its native tool; recursive run keeps one root command.

### D6 — Vitest + @vitest/coverage-v8, per package, one placeholder test each
Root `vitest` config with a `projects`/workspace entry per package; coverage uses the `v8` provider and reports (text + lcov). Each package ships one trivial passing test so `pnpm test` is green and coverage output is produced (AC5). Coverage *reporting* is wired now; the ≥80% *threshold* is enforced by feature tickets, not AB-1001 (see Non-Goals).
- *Alternative rejected:* Jest — Vitest is fixed by SDS §1 and integrates natively with Vite/TS/ESM.

### D7 — Git hooks: Husky orchestrates commit-msg + pre-commit
`.husky/commit-msg` runs `commitlint` (config `@commitlint/config-conventional`). `.husky/pre-commit` runs `lint-staged` (ESLint + Prettier on staged files) and a `gitleaks protect --staged` scan. This satisfies all three AC7 sub-scenarios. `gitleaks` is invoked via the pinned binary/action; CI runs a full `gitleaks detect` independently.
- *Why:* pre-commit is the right place to block secrets and lint staged files; commit-msg is the right place to validate the message.
- *Alternative rejected:* pre-push-only enforcement — too late; a bad commit already exists locally and secrets may already be staged.

### D8 — Prisma bare init
`backend/prisma/schema.prisma` contains only `datasource db { provider = "postgresql"; url = env("DATABASE_URL") }` and `generator client { provider = "prisma-client-js" }`. No models. `prisma generate` must succeed (AC12). Models arrive in AB-1002+.

### D9 — Local Postgres: one container, two databases
`docker-compose.yml` runs a single `postgres:16` service with an init script (`/docker-entrypoint-initdb.d/`) that creates both the dev and test databases. Two `DATABASE_URL`s (dev + test) differ only by database name. Test DB isolation (migrate + truncate between suites) is a test-harness concern for later tickets; AB-1001 only guarantees both DBs are reachable (AC11).
- *Alternative rejected:* two Postgres containers — wasteful; one server with two DBs is the standard local pattern and matches SDS §7.

### D10 — Env validation via Zod in `packages/shared`
A small Zod schema validates `process.env` (`DATABASE_URL`, `JWT_SECRET`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `PORT`) and exports a typed `env`. AB-1001 ships the *pattern* and validates the vars the scaffold needs; feature tickets extend the schema. `.env` is gitignored; a committed `.env.example` documents the keys.

### D11 — CI: one workflow, ordered gate
`.github/workflows/ci.yml` on `pull_request`: checkout → setup Node 22 (from `.nvmrc`) → enable pnpm (via `packageManager`/corepack) → `pnpm install --frozen-lockfile` → `pnpm build` → `pnpm lint --max-warnings 0` → `pnpm format:check` → `pnpm test` → `gitleaks detect`. Any step failing fails the PR (AC13). Dependabot (`.github/dependabot.yml`) covers `npm` and `github-actions` weekly (AC14).

## Risks / Trade-offs

- **[Chosen exact versions carry a fresh advisory or mutual incompatibility (e.g. React 19 peer ranges)]** → Resolve during implementation: pick nearest audit-clean patch, verify peer deps install, re-run `pnpm audit`. The audit gate (AC8) catches advisories before done.
- **[Gitleaks pre-commit hook adds commit latency / false positives]** → Scope the pre-commit scan to staged content (`protect --staged`) and ship a `.gitleaks.toml` allowlist for known-safe patterns; keep the full `detect` in CI. Note: the live PAT currently embedded in this repo's `origin` remote URL is exactly the class of secret gitleaks guards against — rotate it and de-token the remote (out of AB-1001 scope, flagged separately).
- **[ESM/CJS friction between Express 5 (backend, NodeNext) and Vite (frontend, Bundler)]** → Keep resolution per-package (D3); `@app/shared` ships ESM with correct `exports` so both resolvers consume it. Verify the placeholder cross-import builds under both.
- **[`pnpm install --frozen-lockfile` fails in CI if the lockfile drifts]** → Commit `pnpm-lock.yaml` as part of AB-1001; treat lockfile changes as reviewable.
- **[Knip flags placeholder entries/tests as unused]** → Configure `knip.json` with the correct workspace entry points (package `main`/`exports`, test globs, config files) so AC6 is clean without deleting needed scaffold.

## Migration Plan

Greenfield, no data migration. "Deploy" = merge the change branch to `main`; rollback = revert the merge (repo returns to docs-only). Sequence follows tasks.md: workspace skeleton first, then per-package configs, then tooling, then infra/CI. Each phase ends by running the relevant gate command so failures surface locally before CI.

## Open Questions

- **Exact patch versions** — resolved at implementation, recorded in `package.json` + lockfile, gated by `pnpm audit` (D1). Not a blocker; this is the one deliberately deferred decision.
- **Node engine range in `.npmrc`/`engines`** — pin to `^22`/`>=22 <23`? Recommend `engines.node: ">=22 <23"` with `engine-strict=true`; confirm at implementation.
- **Gitleaks distribution** — pinned Go binary vs the official GitHub Action in CI plus a local hook wrapper; recommend the Action in CI and a pinned binary locally. Confirm no license/version issue during install.
