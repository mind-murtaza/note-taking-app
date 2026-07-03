# Tasks — AB-1001 Project Scaffolding & Tooling

Sequenced from proposal.md + plan.md. AB-1001 is scaffolding: "Foundation" = env-pinning, workspace, strict base, the Zod env module, and bare Prisma (no models, no migrations). "Tests" (Phase 4) = one verification per spec scenario (AC1–AC14). `[PARALLEL]` groups have no ordering dependency on each other. Checkpoint commands close each phase.

## 1. Phase 1 — Foundation (serial; everything depends on this)

- [ ] 1.1 Add `.npmrc` with `save-exact=true` + `engine-strict=true` — **must land before any `pnpm add`** so all pins are exact (AC1)
- [ ] 1.2 Add `.nvmrc` (`22`) and `.editorconfig` (LF, charset, indent, trailing newline)
- [ ] 1.3 Create private root `package.json`: `packageManager: "pnpm@11.5.2"`, `engines.node: ">=22 <23"`, scripts `build`(`pnpm -r --stream build`), `lint`(`eslint .`), `format:check`, `format`, `test`(`vitest run --coverage`), `knip`
- [ ] 1.4 Add `pnpm-workspace.yaml` listing `packages/shared`, `backend`, `frontend`, `e2e`
- [ ] 1.5 Extend `.gitignore` (`node_modules/`, `dist/`, `coverage/`, `.env`, Prisma client output); add committed `.env.example` with SDS §8 keys (no values)
- [ ] 1.6 Add `tsconfig.base.json`: `strict` + `noUncheckedIndexedAccess` + `noImplicitOverride` + `exactOptionalPropertyTypes` + shared options (D3)
- [ ] 1.7 Create `packages/shared`: `package.json` (`@app/shared`, `exports` map, zod pinned), `tsconfig.json` extending base, `src/index.ts` placeholder export
- [ ] 1.8 Add `packages/shared/src/env.ts` — Zod schema over `DATABASE_URL`/`JWT_SECRET`/`ACCESS_TOKEN_TTL`/`REFRESH_TOKEN_TTL`/`PORT` + `parseEnv()` (the reusable env pattern, D10); re-export from `index.ts`
- [ ] 1.9 Add bare `backend/prisma/schema.prisma` — datasource (`postgresql`, `env("DATABASE_URL")`) + generator only, **no models** (D8) — the DB foundation
- [ ] 1.10 **Checkpoint P1:** `pnpm install` succeeds; `pnpm --filter @app/shared build` → 0 errors. (Root `lint`/`test` configs arrive in Phase 2, so the full three-command gate starts at P2.)

## 2. Phase 2 — Core implementation `[PARALLEL: A, B, C, D are mutually independent once P1 is done]`

**`[PARALLEL A]` — package skeletons**
- [ ] 2.1 `backend`: `package.json` (express 5.2.1, `@app/shared: workspace:*`, dev/build scripts), `tsconfig.json` (NodeNext), `src/index.ts` placeholder that imports `@app/shared`
- [ ] 2.2 `frontend`: `package.json` (react/react-dom 19.2.7, vite 8.1.3, `@app/shared: workspace:*`), `vite.config.ts`, `index.html`, `src/main.tsx` importing `@app/shared`
- [ ] 2.3 `e2e`: `package.json` (@playwright/test 1.61.1), `tsconfig.json` (`noEmit`), `playwright.config.ts`, placeholder spec

**`[PARALLEL B]` — lint & format**
- [ ] 2.4 Add root `eslint.config.js` (flat): `typescript-eslint` for all TS, React + react-hooks scoped to `frontend/**`, `eslint-config-prettier` **last** (D4); pin ESLint deps exact
- [ ] 2.5 Add `.prettierrc` + `.prettierignore`

**`[PARALLEL C]` — test harness**
- [ ] 2.6 Add root `vitest.config.ts` with `test.projects` per package + `@vitest/coverage-v8` (text + lcov) (D6)
- [ ] 2.7 Add one trivial passing test per package (`shared`, `backend`, `frontend`, `e2e`)

**`[PARALLEL D]` — quality tooling**
- [ ] 2.8 Add `knip.json` aware of the 4 workspaces (entry points from `exports`/`main`, test globs, config files)
- [ ] 2.9 Install + init Husky (`prepare` script); add `commitlint.config.js` + `.husky/commit-msg`; `lint-staged` config + `.husky/pre-commit`; add `gitleaks protect --staged` to pre-commit + `.gitleaks.toml` allowlist (D7)
- [ ] 2.10 **Checkpoint P2:** `pnpm build` → 0 errors/0 warnings (AC2) · `pnpm lint --max-warnings 0` → clean (AC3) · `pnpm test` → green + coverage (AC5) · also `pnpm format:check` (AC4) and `pnpm knip` (AC6) clean

## 3. Phase 3 — Integration

- [ ] 3.1 Confirm cross-package import builds: `backend` and `frontend` both compile importing `@app/shared` (AC9)
- [ ] 3.2 `pnpm --filter backend exec prisma generate` succeeds against the bare schema (AC12)
- [ ] 3.3 Add `docker-compose.yml` (one `postgres:16` service) + `docker/initdb/01-create-databases.sql` creating dev + test DBs (D9)
- [ ] 3.4 `docker compose up -d`; confirm Postgres 16 up and both dev + test DBs reachable via their `DATABASE_URL`s (AC11)
- [ ] 3.5 Add `.github/workflows/ci.yml` on `pull_request`: checkout → Node 22 (`.nvmrc`) → enable pnpm → `pnpm install --frozen-lockfile` → build → lint `--max-warnings 0` → format:check → test → `gitleaks detect` (D11)
- [ ] 3.6 Add `.github/dependabot.yml` for `npm` + `github-actions` (AC14)
- [ ] 3.7 Commit `pnpm-lock.yaml`; grep-confirm every `package.json` uses exact versions — no `^`/`~`/`@latest` (AC1)
- [ ] 3.8 **Checkpoint P3:** full local gate green — `pnpm install && pnpm build && pnpm lint --max-warnings 0 && pnpm test` — plus `docker compose ps` healthy and Prisma client generated

## 4. Phase 4 — Verification (one check per spec scenario)

- [ ] 4.1 AC1 — no `^`/`~`/`@latest` in any `package.json`; `save-exact` enforced (both scenarios)
- [ ] 4.2 AC8 — `pnpm audit --audit-level=high` reports 0 high/critical; bump any flagged pin to nearest clean patch and re-audit
- [ ] 4.3 AC2 — `pnpm build` → 0 errors, 0 warnings across all packages
- [ ] 4.4 AC10 — introduce a deliberate type error, confirm `pnpm build` fails, then revert (proves strict mode active)
- [ ] 4.5 AC3 + AC4 — `pnpm lint --max-warnings 0` clean and `pnpm format:check` clean
- [ ] 4.6 AC5 — `pnpm test` green and coverage output produced
- [ ] 4.7 AC6 — `pnpm knip` reports zero unused files/exports/deps
- [ ] 4.8 AC7 — a non-Conventional commit message is rejected by commitlint
- [ ] 4.9 AC7 — a planted secret is blocked by gitleaks
- [ ] 4.10 AC7 — staged files are linted/formatted by lint-staged on commit
- [ ] 4.11 AC9 — backend import of `@app/shared` resolves and builds; frontend import resolves and builds
- [ ] 4.12 AC11 — dev and test databases both reachable via `DATABASE_URL`
- [ ] 4.13 AC12 — `prisma generate` succeeds against the bare schema
- [ ] 4.14 AC13 — open a PR; the CI workflow runs the full gate in order and passes
- [ ] 4.15 AC14 — `.github/dependabot.yml` declares both `npm` and `github-actions` ecosystems
- [ ] 4.16 **Final checkpoint:** `pnpm install && pnpm build && pnpm lint --max-warnings 0 && pnpm format:check && pnpm test && pnpm knip` all green + audit clean — all 14 ACs verified
