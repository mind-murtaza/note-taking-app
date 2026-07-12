# Technical Plan — AB-1001 Project Scaffolding & Tooling

**Change:** `openspec/changes/ab-1001-project-scaffolding/` (AB-1001)
**Reads:** proposal.md, specs/project-scaffolding/spec.md, design.md, docs/SRS.MD §10 + §1–§2, AGENTS.md, backend/frontend/packages CLAUDE.md
**Status:** awaiting approval — no implementation until approved.

This plan is the concrete build layer under the already-approved design.md (decisions D1–D11) and tasks.md (ordered steps). It pins exact file paths, config skeletons, the one typed shape (env schema), version pins, and checkpoint commands. Where a decision's *why* lives in design.md, this plan gives the *what it looks like*.

---

## 1. Current state & reuse scan (step 5)

Scanned the tree: **no `package.json`, `tsconfig`, lockfile, or config file exists** anywhere outside `.claude/`. Fully greenfield. Nothing to reuse as code. What carries forward is convention, not files:

- Package identity `@app/shared` and the route→service→repository→Prisma layering (AGENTS.md §2, §5; backend/CLAUDE.md).
- Env keys `DATABASE_URL`, `JWT_SECRET`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `PORT` (SDS §8).
- Tooling list and the `build → lint → test` gate order (AGENTS.md §4, §13).

**DB changes:** none. Prisma is bare (datasource + generator, zero models). There is no prior schema, so "backward compatible" is N/A — this is the first `schema.prisma` and it defines no tables. Models are AB-1002+.

**TypeScript domain interfaces:** none in AB-1001. No domain types, Zod domain schemas, or API contracts are created here (those are per-feature tickets). The only typed shape produced is the env module (§4). This is called out honestly rather than invented.

---

## 2. Target file tree (exact paths to create)

```
/                                     (repo root — all NEW)
├── package.json                      private root; scripts + packageManager + engines
├── pnpm-workspace.yaml               lists the 4 packages
├── pnpm-lock.yaml                    committed after install (AC1/D1)
├── tsconfig.base.json                strict base (D3)
├── .npmrc                            save-exact=true, engine-strict=true (task 1.1)
├── .nvmrc                            22
├── .editorconfig
├── .gitignore                        extend: node_modules, dist, coverage, .env, prisma client
├── .env.example                      SDS §8 keys, no values
├── eslint.config.js                  flat config (D4)
├── .prettierrc
├── .prettierignore
├── vitest.config.ts                  root, projects[] + v8 coverage (D6)
├── commitlint.config.js
├── knip.json
├── .gitleaks.toml                    allowlist
├── docker-compose.yml                postgres:16, dev + test DB (D9)
├── docker/initdb/01-create-databases.sql
├── .husky/
│   ├── pre-commit                    lint-staged + gitleaks protect --staged
│   └── commit-msg                    commitlint
├── .github/
│   ├── workflows/ci.yml              install→build→lint→format→test→gitleaks (D11)
│   └── dependabot.yml                npm + github-actions (AC14)
├── packages/shared/
│   ├── package.json                  name @app/shared, exports map
│   ├── tsconfig.json                 extends base, lib emit
│   └── src/
│       ├── index.ts                  placeholder export + re-exports
│       ├── env.ts                    Zod env schema (§4)
│       └── index.test.ts             1 passing test
├── backend/
│   ├── package.json                  express 5, @app/shared workspace:*
│   ├── tsconfig.json                 extends base, NodeNext
│   ├── prisma/schema.prisma          bare (D8)
│   └── src/
│       ├── index.ts                  placeholder; imports @app/shared (AC9)
│       └── index.test.ts             1 passing test
├── frontend/
│   ├── package.json                  react 19 + vite, @app/shared workspace:*
│   ├── tsconfig.json                 extends base, Bundler
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx                  placeholder; imports @app/shared (AC9)
│       └── main.test.ts              1 passing test
└── e2e/
    ├── package.json                  @playwright/test
    ├── tsconfig.json                 extends base, noEmit
    ├── playwright.config.ts
    └── tests/smoke.spec.ts           1 passing placeholder (or unit-level test for coverage)
```

**Files modified (vs. created):** only `.gitignore` (exists, one line today) is extended. Everything else is new. `backend/CLAUDE.md`, `frontend/CLAUDE.md`, `packages/shared/CLAUDE.md` stay as-is.

---

## 3. Version pins (probed from registry 2026-07-04)

Real latest published versions below. Per ADR-006 / design D1 these are pinned **exact** at `pnpm add` time and frozen by `pnpm-lock.yaml`; `pnpm audit --audit-level=high` must be clean before done (AC8). Local env confirmed: **Node v22.12.0, pnpm 11.5.2**.

| Package | Pin | Where |
|---|---|---|
| typescript | 6.0.3 | root (dev) |
| @types/node | 26.1.0 | root (dev) |
| react / react-dom | 19.2.7 | frontend |
| vite | 8.1.3 | frontend (dev) |
| @vitejs/plugin-react | 6.0.3 | frontend (dev) |
| express | 5.2.1 | backend |
| @types/express | 5.0.6 | backend (dev) |
| prisma / @prisma/client | 7.8.0 | backend |
| zod | 4.4.3 | packages/shared |
| vitest / @vitest/coverage-v8 | 4.1.9 | root (dev) |
| eslint | 10.6.0 | root (dev) |
| typescript-eslint | 8.62.1 | root (dev) |
| prettier | 3.9.4 | root (dev) |
| eslint-config-prettier | 10.1.8 | root (dev) |
| knip | 6.24.0 | root (dev) |
| husky | 9.1.7 | root (dev) |
| lint-staged | 17.0.8 | root (dev) |
| @commitlint/cli + config-conventional | 21.2.0 | root (dev) |
| @playwright/test | 1.61.1 | e2e (dev) |

> Note the majors are ahead of what a mid-2025 memory would suggest (TS 6, Vite 8, ESLint 10, Prisma 7, Zod 4, Vitest 4). Config skeletons in §5 are written for these majors (flat ESLint via `typescript-eslint`, Vitest `projects`, not the deprecated `vitest.workspace.ts`). TanStack Query 5.101.2 / Zustand 5.0.14 belong to frontend feature tickets, not AB-1001.

---

## 4. The one typed shape — env validation (`packages/shared/src/env.ts`)

The reusable pattern for all later config. Zod 4 syntax.

```ts
import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(1),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('7d'),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  return envSchema.parse(source);
}
```

`src/index.ts` exports a placeholder (`export const SHARED_PACKAGE = '@app/shared';`) plus `export * from './env';`, giving `backend`/`frontend` something real to import for the AC9 cross-import proof.

---

## 5. Load-bearing config skeletons

**`.npmrc`** (must land before any `pnpm add` — task 1.1)
```
save-exact=true
engine-strict=true
```

**Root `package.json`** (scripts fan out with `-r` for build; lint/format/test/knip run once at root since their configs are workspace-aware — D5)
```jsonc
{
  "name": "note-taking-app",
  "private": true,
  "packageManager": "pnpm@11.5.2",
  "engines": { "node": ">=22 <23" },
  "scripts": {
    "build": "pnpm -r --stream build",
    "lint": "eslint .",
    "format:check": "prettier --check .",
    "format": "prettier --write .",
    "test": "vitest run --coverage",
    "knip": "knip"
  }
}
```
> `lint --max-warnings 0` is invoked by the caller (AGENTS.md gate + CI) as `pnpm lint --max-warnings 0`; ESLint forwards the flag.

**`pnpm-workspace.yaml`**
```yaml
packages:
  - packages/shared
  - backend
  - frontend
  - e2e
```

**`tsconfig.base.json`** (D3)
```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true
  }
}
```
Per-package `tsconfig.json` sets `extends: "../../tsconfig.base.json"` (or `./`), `moduleResolution` (`NodeNext` backend, `Bundler` frontend), `rootDir`/`outDir`; `e2e` adds `noEmit: true`.

**`eslint.config.js`** (flat, ESLint 10 + typescript-eslint 8)
```js
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
// react + react-hooks plugins imported and scoped to frontend/** only

export default tseslint.config(
  { ignores: ['**/dist/**', '**/coverage/**', '**/node_modules/**'] },
  ...tseslint.configs.recommendedTypeChecked,
  // { files: ['frontend/**'], ...react rules },
  prettier, // last — disables format rules
);
```

**`vitest.config.ts`** (root, projects — Vitest 4, D6)
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/shared', 'backend', 'frontend', 'e2e'],
    coverage: { provider: 'v8', reporter: ['text', 'lcov'] },
  },
});
```
> Coverage *reporting* only in AB-1001; the ≥80% threshold is a per-feature gate (design Non-Goals). `e2e` project runs unit-level placeholder for coverage; Playwright browser specs run via `pnpm --filter @app/e2e test` separately.

**`backend/prisma/schema.prisma`** (bare — D8)
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
generator client {
  provider = "prisma-client-js"
}
```

**`docker-compose.yml` + `docker/initdb/01-create-databases.sql`** (one container, two DBs — D9)
```yaml
services:
  postgres:
    image: postgres:16
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: notes_dev
    volumes:
      - ./docker/initdb:/docker-entrypoint-initdb.d
```
init SQL: `CREATE DATABASE notes_test;` → dev `DATABASE_URL=.../notes_dev`, test `.../notes_test`.

**`.husky/pre-commit`**: `pnpm lint-staged` then `gitleaks protect --staged --redact`.
**`.husky/commit-msg`**: `pnpm commitlint --edit "$1"`.
**`commitlint.config.js`**: `export default { extends: ['@commitlint/config-conventional'] };`
**lint-staged** (in root package.json or `.lintstagedrc`): `{ "*.{ts,tsx}": ["eslint --fix", "prettier --write"], "*.{json,md,yml}": ["prettier --write"] }`.

**`.github/workflows/ci.yml`** (D11): on `pull_request` → checkout → `actions/setup-node` (node-version-file `.nvmrc`) → `corepack enable` → `pnpm install --frozen-lockfile` → `pnpm build` → `pnpm lint --max-warnings 0` → `pnpm format:check` → `pnpm test` → `gitleaks/gitleaks-action`.

**`.github/dependabot.yml`** (AC14): `package-ecosystem: npm` (root, weekly) + `package-ecosystem: github-actions` (weekly).

---

## 6. Architecture decisions (reasoning → design.md)

Full rationale + alternatives are in design.md D1–D11. Plan-level summary:

- **D1 version policy** — pins in §3, gated by `pnpm audit` (AC8). The one deferred decision.
- **D2 `@app/*` + `workspace:*`** — resolver-agnostic; matches AGENTS.md §12 alias.
- **D3 one strict base tsconfig** — no project references (YAGNI for 4 packages).
- **D4 root flat ESLint + Prettier split** — `eslint-config-prettier` last.
- **D5 build fans out `-r`; lint/format/test/knip once at root.**
- **D6 Vitest `projects` + v8** — reporting now, threshold later.
- **D7 husky commit-msg + pre-commit** — secrets blocked before commit, not at push.
- **D8 bare Prisma; D9 one container two DBs; D10 Zod env; D11 single CI gate.**

---

## 7. Checkpoint commands (step 6)

Per-phase (run after the phase that enables it):

```bash
pnpm install                                  # after §2 root (AC1 install)
pnpm --filter @app/shared build               # after packages/shared
pnpm build                                     # after all packages (AC2)
pnpm lint --max-warnings 0                     # after ESLint (AC3)
pnpm format:check                              # after Prettier (AC4)
pnpm test                                      # after Vitest (AC5)
pnpm knip                                       # after knip.json (AC6)
pnpm --filter backend exec prisma generate     # after prisma (AC12)
docker compose up -d && docker compose ps      # after compose (AC11)
pnpm audit --audit-level=high                  # final (AC8)
```

**Full gate (AGENTS.md §4 order), run before declaring done:**
```bash
pnpm install && pnpm build && pnpm lint --max-warnings 0 && pnpm format:check && pnpm test && pnpm knip
```

---

## 8. Acceptance-criteria → verification matrix

| AC | Verified by | Task |
|---|---|---|
| AC1 exact pins + save-exact | grep no `^`/`~`; `.npmrc`; `pnpm install` | 1.1, 11.1 |
| AC2 build 0/0 | `pnpm build` | 11.3 |
| AC3 lint clean | `pnpm lint --max-warnings 0` | 5.3 |
| AC4 format clean | `pnpm format:check` | 5.3 |
| AC5 test + coverage | `pnpm test` | 6.3 |
| AC6 knip clean | `pnpm knip` | 9.2 |
| AC7 hooks | bad commit / planted secret / staged lint | 8.5 |
| AC8 audit 0 high/crit | `pnpm audit --audit-level=high` | 11.2 |
| AC9 shared importable | cross-import builds | 4.4 |
| AC10 strict proven | deliberate type error fails build | 11.4 |
| AC11 postgres dev+test | `docker compose up` | 7.4 |
| AC12 prisma generate | `prisma generate` | 7.2 |
| AC13 CI gate on PR | workflow passes | 10.3 |
| AC14 dependabot | inspect `.github/dependabot.yml` | 10.2 |

---

## 9. Sequencing (→ tasks.md, 11 groups)

1 root+env pinning → 2 tsconfig base → 3 shared (+env) → 4 backend/frontend/e2e skeletons (+cross-import) → 5 lint/format → 6 vitest/coverage → 7 prisma + postgres → 8 husky/lint-staged/commitlint/gitleaks → 9 knip → 10 CI + dependabot → 11 version integrity + final gate. Rationale: `.npmrc` first (pins must be exact from the first add); tooling after packages exist to lint/test against; CI last (needs all scripts green locally first).

---

## 10. Open items & risks (→ design.md Risks)

- **Exact patches** resolved at `pnpm add`, frozen in lockfile, gated by audit (only deferred decision).
- **Major-version friction** — TS 6 / ESLint 10 / Vite 8 / Prisma 7 / Zod 4 are current; if any pin surfaces a peer-dep clash or advisory, bump to nearest clean patch and re-audit (§3, AC8).
- **Gitleaks** — pre-commit `protect --staged` locally + Action in CI. (Also: the live PAT in this repo's `origin` remote URL is out-of-scope for AB-1001 but should be rotated + de-tokened separately.)
- **Knip false positives** on placeholder entries — configure `knip.json` workspace entry points so AC6 is clean without deleting scaffold.

---

## Approval gate

No files created until approved. On approval: branch `feature/setup/AB-1001-project-scaffolding` off `main`, then implement group-by-group (§9), running each phase's checkpoint before moving on. Implementation runs via `/opsx:apply` against tasks.md.
