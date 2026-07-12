## Why

The repository currently holds only `docs/` and `.claude/` — there is no `package.json`, no workspace, no build, lint, test, or CI. Every functional ticket (AB-1002 auth through AB-1016 E2E) assumes a working pnpm monorepo with enforced quality gates already exists. AB-1001 builds that foundation once so no later ticket has to reinvent tooling or ship on an unenforced baseline. It has no functional requirement of its own (FRS §9); its contract is the acceptance criteria AC1–AC14 in SDS §10.2.

## What Changes

- Add the **pnpm workspace skeleton**: root `package.json` (private) + `pnpm-workspace.yaml`, and the four packages `packages/shared`, `backend`, `frontend`, `e2e`, each with its own `package.json` + `tsconfig.json` and a placeholder entry so builds pass.
- Add **strict TypeScript**: root `tsconfig.base.json` (strict mode) that each package extends; `@app/shared` resolvable from `backend` and `frontend` via the workspace protocol.
- Add **Zod** to `packages/shared` plus an env-validation module (the pattern reused by all later config).
- Add **linting/formatting**: ESLint flat config (TypeScript + React rules) + Prettier + `eslint-config-prettier`.
- Add **code-quality tooling**: Knip (unused code), Husky (git hooks), Commitlint (Conventional Commits), Gitleaks (secret scanning), lint-staged (pre-commit ESLint + Prettier on staged files).
- Add **Vitest + @vitest/coverage-v8** at root and per package, one trivial passing test each, coverage wired for the ≥80% gate.
- Add **Prisma (bare init)**: installed, `schema.prisma` with datasource + generator blocks only — **no models** (models belong to their owning tickets).
- Add **local Postgres 16** via `docker-compose.yml` with separate dev and test databases.
- Add **environment pinning**: `.editorconfig`, `.nvmrc` (Node 22), `packageManager` (pnpm), `.npmrc` (`engine-strict=true`, `save-exact=true`).
- Add **CI**: GitHub Actions running install → build → lint → format:check → test → gitleaks on every PR.
- Add **Dependabot** config for the `npm` and `github-actions` ecosystems.
- All dependency versions **pinned exact** (no `^`/`~`/`@latest`), gated by `pnpm audit --audit-level=high` reporting zero high/critical advisories (ADR-006).

## Capabilities

### New Capabilities
- `project-scaffolding`: The monorepo skeleton, strict-TypeScript build, quality tooling (ESLint, Prettier, Knip, Husky, Commitlint, Gitleaks, lint-staged), Vitest coverage harness, bare Prisma setup, local Postgres, environment pinning, CI, and Dependabot — everything AB-1002+ builds on. Encodes AC1–AC14 (SDS §10.2) as verifiable requirements.

### Modified Capabilities
<!-- None. openspec/specs/ is empty; this is the first capability in a greenfield repo. -->

## Impact

- **New files (repo root):** `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.npmrc`, `.nvmrc`, `.editorconfig`, `eslint.config.js`, `.prettierrc`, `.prettierignore`, `commitlint.config.js`, `knip.json`, `docker-compose.yml`, `.husky/` hooks, `.github/workflows/ci.yml`, `.github/dependabot.yml`.
- **New per-package files:** `package.json` + `tsconfig.json` + placeholder source/test in `packages/shared`, `backend`, `frontend`, `e2e`; `backend/prisma/schema.prisma` (bare).
- **Dependencies:** first `node_modules`; all pins gated by `pnpm audit`. No runtime/domain dependencies beyond Zod (shared) and Prisma (backend bare init).
- **No domain logic, no Prisma models, no deployment/CD, no application Dockerfiles** — those are explicitly out of scope for AB-1001 (SDS §10.4).
- **Downstream:** unblocks AB-1002+; every later ticket inherits the enforced `build → lint → test` gate and the `@app/shared` import path.
