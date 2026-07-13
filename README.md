# Note-taking App

A full-stack note-taking application for authenticated users to create, organize,
search, share, and restore rich-text notes. The approved product baseline lives in
[docs/FRS.MD](docs/FRS.MD) and the technical design lives in [docs/SRS.MD](docs/SRS.MD).

This repository is currently at the **AB-1001 project-scaffolding** stage: the
monorepo, quality tooling, local PostgreSQL, CI, and placeholder package entry points
are in place. Domain implementation for authentication, notes, tags, search, sharing,
and version history is planned for AB-1002 and later tickets.

This root README is the **project hub** — the whole-picture, cross-cutting view. Each
workspace package has its own README with the deep, package-specific detail; this file
links out to them rather than duplicating them.

## Table of Contents

- [Documentation Map](#documentation-map)
- [Project Status](#project-status)
- [Product Scope](#product-scope)
- [Core Features](#core-features)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Tech Stack](#tech-stack)
- [Root Tooling](#root-tooling)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Commands](#commands)
- [API Design](#api-design)
- [Database Design](#database-design)
- [Testing Strategy](#testing-strategy)
- [Quality Gates](#quality-gates)
- [Git Workflow](#git-workflow)
- [Documentation Maintenance](#documentation-maintenance)
- [Out of Scope](#out-of-scope)
- [Roadmap](#roadmap)
- [Authoritative References](#authoritative-references)

## Documentation Map

| README | Scope |
| --- | --- |
| This file (root) | Whole-picture hub: scope, architecture, monorepo setup, workflow, links |
| [packages/shared/README.md](packages/shared/README.md) | The shared contract package (Zod schemas, types, constants) |
| [backend/README.md](backend/README.md) | The Express API: layering, run/test, Prisma/DB, endpoints |
| [frontend/README.md](frontend/README.md) | The React app: data/state flow, run/test, UI system |
| [e2e/README.md](e2e/README.md) | Playwright end-to-end journey tests |

Deeper references: [AGENTS.md](AGENTS.md) (working rules for AI tools), [docs/FRS.MD](docs/FRS.MD),
[docs/SRS.MD](docs/SRS.MD), and [openspec/](openspec/) (spec-driven change proposals).

## Project Status

Each package README carries its own `Status` block (implemented vs. not-yet). At the
repo level:

Implemented now (AB-1001):

- pnpm workspace with four packages: `packages/shared`, `backend`, `frontend`, `e2e`.
- Strict TypeScript base configuration shared across packages.
- Root ESLint flat config, Prettier, Knip, Vitest coverage, Husky, lint-staged,
  Commitlint, Gitleaks, GitHub Actions, and Dependabot.
- Local PostgreSQL 16 via Docker Compose with `notes_dev` and `notes_test` databases.
- Bare Prisma setup in `backend/prisma/schema.prisma`.
- Placeholder backend `/health` route, placeholder React app entry, shared package
  entry with Zod-based environment validation, and one placeholder test per package.

Not implemented yet:

- Auth, notes, tags, search, sharing, and version-history domain logic.
- Final Prisma models and migrations.
- Real frontend pages, routing, editor, state stores, and API hooks.
- Full integration and E2E coverage for product behavior.

## Product Scope

The finished application is a full-stack notes product with three actors:

| Actor | Access |
| --- | --- |
| Visitor | Register, log in, request password reset, reset password, and view public shared notes. |
| User | Create, read, update, soft-delete, tag, search, share, and restore only their own notes. |
| System | Enforce token expiry, share-link expiry, refresh-token reuse detection, and version retention. |

The application is intentionally user-scoped. A user must never be able to read,
modify, reference, or infer the existence of another user's data (FRS 1.6.2).

## Core Features

- **Authentication** — register (bcrypt-hashed passwords), login with short-lived JWT
  access tokens + opaque rotated refresh tokens, refresh-token reuse detection
  (family revocation), logout, and forgot/reset password via a console-logged 6-digit
  OTP. Responses never leak whether an email exists.
- **Notes** — rich-text (TipTap JSON) CRUD with a plain-text extract for search,
  single-note fetch with tags, listing with pagination/sorting/tag-filtering, and soft
  delete (excluded from reads, lists, search, and shares).
- **Tags** — user-scoped tags with name + hex color, unique names per user, note
  counts, update, and delete (without deleting notes).
- **Search** — PostgreSQL full-text search over the user's own non-deleted notes,
  relevance-ranked, with highlighted `ts_headline` snippets, same pagination contract.
- **Sharing** — public read-only share links (optional expiry, multiple per note),
  returning only title/content/updatedAt, with atomic view-count increments.
- **Version History** — a snapshot per title/content change (no snapshot on no-ops),
  list/view/restore, at most 50 versions per note, all in one transaction.

Full requirements: [docs/FRS.MD](docs/FRS.MD).

## Architecture

A TypeScript pnpm monorepo with a shared contract package and separated
backend/frontend applications.

### Backend flow

```text
HTTP request → Express route → shared Zod validation → service
             → repository → Prisma / PostgreSQL → response envelope
```

- Routes validate input and call services; routes never import Prisma.
- Services own business rules and ownership checks; services never import Express types.
- Repositories are the only layer that imports the Prisma client (incl. raw SQL).
- Ownership violations return `404 NOT_FOUND`, never `403`.
- Errors are thrown as typed domain errors and translated by one central middleware.

### Frontend flow

```text
React page → components → TanStack Query hook → API client → backend envelope
          → Zustand for client/session state
```

- Server state lives in TanStack Query; client/UI state lives in Zustand.
- Forms and requests reuse Zod schemas from `@app/shared`.
- Server-generated `<mark>` search highlights are sanitized before display.

### Shared contract

`packages/shared` is the single source for Zod schemas, inferred types, API response
types, and constants (pagination limits, title lengths, error codes). Backend and
frontend import from `@app/shared`; they never duplicate schemas or magic values.

Package-level architecture detail: [backend/README.md](backend/README.md),
[frontend/README.md](frontend/README.md), [packages/shared/README.md](packages/shared/README.md).

## Repository Structure

```text
/
├── docs/
│   ├── FRS.MD                 Product requirements
│   ├── SRS.MD                 Technical design (SDS)
│   └── superpowers/specs/     Design docs for cross-cutting changes
├── openspec/                  Spec-driven change proposals and archived changes
├── packages/
│   └── shared/                Shared schemas, types, constants, env parsing (@app/shared)
├── backend/
│   ├── prisma/                Prisma schema and future migrations
│   └── src/                   Express app and future backend modules
├── frontend/
│   └── src/                   React app and future UI modules
├── e2e/                       Playwright configuration and E2E tests
├── docker/initdb/             PostgreSQL init scripts
├── .github/
│   ├── workflows/ci.yml       Build, lint, format, test, and secret scan
│   └── dependabot.yml         Dependency update automation
├── .husky/                    Git hooks (pre-commit, commit-msg, pre-push)
├── docker-compose.yml         Local PostgreSQL 16
├── pnpm-workspace.yaml        Workspace package map
├── package.json               Root scripts and tooling dependencies
└── tsconfig.base.json         Shared strict TypeScript options
```

The target per-package `src/` layouts (`routes/`, `services/`, `repositories/` … for
backend; `pages/`, `components/`, `api/`, `stores/` … for frontend) are documented in
each package's README.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Monorepo | pnpm workspaces |
| Runtime | Node.js 22 |
| Language | TypeScript, strict mode |
| Shared validation | Zod |
| Backend | Express 5 |
| Database | PostgreSQL 16 |
| ORM | Prisma |
| Frontend | React 19, Vite |
| Planned frontend data / state | TanStack Query / Zustand |
| Planned editor | TipTap |
| Planned UI system | shadcn/ui, Radix, Tailwind CSS, lucide-react, Sonner |
| Unit/integration testing | Vitest, Supertest |
| E2E testing | Playwright |
| Formatting / linting | Prettier, ESLint |
| Repo hygiene | Knip, Husky, lint-staged, Commitlint, Gitleaks |
| CI / dependency updates | GitHub Actions / Dependabot |

All direct dependency versions are pinned exactly in `package.json` files — never
`@latest`, `^`, or `~`. Per-package dependency rationale (why each dependency exists,
current and planned) lives in that package's README.

## Root Tooling

Dependencies installed at the workspace root drive quality gates across every package.

| Dependency | Why it is used |
| --- | --- |
| `typescript` | Strict static typing across every package. |
| `vitest` + `@vitest/coverage-v8` | Unit/integration tests and coverage for the ≥80% gate. |
| `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks` | Code-quality and React-hook linting. |
| `eslint-config-prettier` | Disables ESLint rules that conflict with Prettier. |
| `globals` | Node/browser globals for the ESLint flat config. |
| `prettier` | Consistent formatting across TS, JSON, Markdown, YAML. |
| `knip` | Detects unused files, exports, and dependencies. |
| `husky` + `lint-staged` | Git hooks; run lint/format on staged files only. |
| `@commitlint/cli` + `@commitlint/config-conventional` | Enforce Conventional Commits. |

Infrastructure: PostgreSQL 16 (Docker) for local dev/test DBs, GitHub Actions for PR
quality gates, the Gitleaks action for CI secret scanning, and Dependabot for updates.

## Environment Variables

Copy `.env.example` to `.env` for local development.

```dotenv
DATABASE_URL="postgresql://app:app@localhost:5432/notes_dev"
JWT_SECRET="replace-with-a-local-secret"
ACCESS_TOKEN_TTL="15m"
REFRESH_TOKEN_TTL="7d"
PORT="3000"
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma/backend. |
| `JWT_SECRET` | Yes | Secret used to sign/verify JWT access tokens. Must not be empty. |
| `ACCESS_TOKEN_TTL` | Defaults to `15m` | Access-token lifetime. |
| `REFRESH_TOKEN_TTL` | Defaults to `7d` | Refresh-token lifetime. |
| `PORT` | Defaults to `3000` | Backend HTTP port. |

`.env` is intentionally ignored by Git. Never commit secrets, tokens, or real credentials.

## Local Development

### Prerequisites

- Node.js 22 (`.nvmrc` is committed).
- pnpm 11.5.2 via Corepack.
- Docker and Docker Compose for local PostgreSQL.

### Install and start the database

```bash
corepack enable
pnpm install
docker compose up -d          # PostgreSQL 16: notes_dev + notes_test
```

Default local credentials: `app` / `app` on `localhost:5432`. `notes_dev` is created via
`POSTGRES_DB`; `notes_test` via `docker/initdb/01-create-databases.sql`.

### Build the shared package first

`@app/shared` exports from `packages/shared/dist`. Build it before starting the backend
or frontend dev servers, and rebuild when its exports change:

```bash
pnpm --filter @app/shared build
```

### Run the apps

Per-package run instructions (dev server, health check, preview, Prisma, tests) live in
each package README:

- [backend/README.md → Setup & Run](backend/README.md#setup--run)
- [frontend/README.md → Setup & Run](frontend/README.md#setup--run)
- [e2e/README.md → Setup & Run](e2e/README.md#setup--run)

## Commands

Root commands (run across all packages):

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install all workspace dependencies from the lockfile. |
| `pnpm build` | Build all workspace packages recursively. |
| `pnpm lint --max-warnings 0` | Run ESLint with a zero-warning policy. |
| `pnpm format` / `pnpm format:check` | Format the repo / check formatting without writing. |
| `pnpm test` | Run Vitest projects with coverage. |
| `pnpm knip` | Detect unused files, exports, and dependencies. |

Per-package commands (`pnpm --filter @app/<pkg> …`) and Prisma commands are documented
in each package README. Linting and formatting are repo-wide from the root.

## API Design

REST under base path `/api`. Every response uses a uniform envelope:

```jsonc
{ "data": { ... } }                                                   // success
{ "data": [ ... ], "meta": { "page": 1, "limit": 20, "total": 57, "totalPages": 3 } } // lists
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "fields": [ ... ] } }         // error
```

`fields[]` appears only on `VALIDATION_ERROR`.

| Situation | Status | Error code |
| --- | --- | --- |
| Created | `201` | — |
| Read/update/action success | `200` | — |
| Delete/revoke/logout success | `204` | — |
| Zod validation failure | `400` | `VALIDATION_ERROR` |
| Missing/invalid/expired access token | `401` | `UNAUTHORIZED` |
| Bad credentials / OTP / refresh token | `401` | `INVALID_CREDENTIALS` / `INVALID_OTP` / `INVALID_REFRESH_TOKEN` |
| Not found or not owned | `404` | `NOT_FOUND` |
| Duplicate email / tag name | `409` | `EMAIL_TAKEN` / `TAG_NAME_TAKEN` |
| Unhandled server error | `500` | `INTERNAL_ERROR` |

The full endpoint list per domain is in [docs/SRS.MD §5.3](docs/SRS.MD); backend
implementation detail is in [backend/README.md](backend/README.md#endpoints).

## Database Design

PostgreSQL 16 via Prisma. The schema currently holds only the datasource + generator
(bare, per AB-1001); the target models (`User`, `RefreshToken`, `PasswordResetOtp`,
`Note`, `Tag`, `NoteTag`, `ShareLink`, `NoteVersion`) and the full-text search design
(generated `tsvector` column + GIN index, `websearch_to_tsquery`, `ts_rank`,
`ts_headline`) land with their owning tickets.

Details: [backend/README.md → Prisma & Database](backend/README.md#prisma--database) and
[docs/SRS.MD §3](docs/SRS.MD).

## Testing Strategy

| Level | Tool | Scope |
| --- | --- | --- |
| Unit | Vitest | Services, libraries, helpers, shared schemas. |
| API integration | Vitest + Supertest | Every endpoint, happy path, and every FRS error scenario. |
| E2E | Playwright | Register → login → create/tag/edit → search → share → restore → logout. |

- Tests live next to what they cover as `*.test.ts`, except E2E tests in `e2e/tests`.
- Integration tests use `notes_test`, migrated and truncated between suites.
- New code must meet ≥80% coverage; each FRS scenario gets a named test.

## Quality Gates

Run this checkpoint after every phase and before commit:

```bash
pnpm build                    # 0 errors/warnings
pnpm lint --max-warnings 0
pnpm format:check
pnpm test
```

Additional checks: `pnpm knip` and `pnpm audit --audit-level=high`. CI runs install,
build, lint, format check, tests, and Gitleaks on PRs and pushes to `dev` and `main`.

## Git Workflow

- **Branches:** `feature/{domain}/AB-{ticket}-{short-name}` (never commit to `main`).
- **Commits:** Conventional Commits — `feat(scope): description AB#ticket` (also `fix`,
  `chore`, `test`, `refactor`, `docs`); scope = domain.
- **Local hooks:** `pre-commit` runs lint-staged + Gitleaks; `commit-msg` runs
  Commitlint; `pre-push` warns if code changed without a README update (see below).

## Documentation Maintenance

Documentation follows a **hub + per-package** model (see [Documentation Map](#documentation-map)):
the root README holds cross-cutting content, and each package README owns its own deep
detail — every fact lives in exactly one place.

READMEs are kept current **per ticket**, driven by what the ticket actually changed. At
ticket close (part of Definition of Done), reconcile the affected README(s):

| What the ticket changed | Update |
| --- | --- |
| New dependency | Dependency table (Planned → current) in the package README (+ root Tech Stack if a new technology) |
| New feature | Feature section + package `Status` block (+ root Core Features / Roadmap) |
| New module / directory | Structure section in the package README (+ root tree if top-level) |
| New endpoint | Endpoints section in [backend/README.md](backend/README.md) |
| New command / env var | Commands / Environment Variables (root) |

A non-blocking `.husky/pre-push` hook prints a reminder when a push contains code
changes but no README change. The full rationale is in
[docs/superpowers/specs/2026-07-13-readme-structure-design.md](docs/superpowers/specs/2026-07-13-readme-structure-design.md).

## Out of Scope

Explicitly not part of this project (implementing any is a violation): real-time
collaborative editing, file/image attachments, a mobile app, OAuth/social login, note
folders or nesting, and actual email sending (password-reset OTPs are logged to the
server console only).

## Roadmap

| Ticket | Area | Expected work |
| --- | --- | --- |
| AB-1001 | Project scaffolding | Monorepo, tooling, CI, local DB, bare Prisma. |
| AB-1002 | Auth | Register, login, refresh, logout. |
| AB-1003 | Password reset | Forgot/reset password with console OTP. |
| AB-1004 | Notes CRUD | Create, read, update, soft delete. |
| AB-1005 | Notes listing | Pagination, sorting, tag filtering. |
| AB-1006 | Tags | User-scoped tag CRUD and note counts. |
| AB-1007 | Search | PostgreSQL full-text search and highlighting. |
| AB-1008 | Sharing | Public read-only share links. |
| AB-1009 | Versions | Snapshot, list, view, restore, purge. |
| AB-1010+ | Frontend | Auth UI, notes UI, editor, search, sharing, versions. |
| AB-1016 | E2E | Full user journey coverage. |
| AB-1017 | Docs | Per-package READMEs, hub model, per-ticket update trigger. |

## Authoritative References

- [AGENTS.md](AGENTS.md) — working rules for AI tools in this repository.
- [CLAUDE.md](CLAUDE.md) — Claude Code operating rules.
- [docs/FRS.MD](docs/FRS.MD) — functional requirements.
- [docs/SRS.MD](docs/SRS.MD) — technical design.
- [openspec/project.md](openspec/project.md) — spec-driven project context.
- Package READMEs: [packages/shared](packages/shared/README.md),
  [backend](backend/README.md), [frontend](frontend/README.md), [e2e](e2e/README.md).
