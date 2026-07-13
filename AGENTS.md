# AGENTS.md

Single source of truth for any AI tool (Claude, Copilot, Cursor, etc.) working in this repo.
Full detail lives in [docs/FRS.MD](docs/FRS.MD) (requirements) and [docs/SRS.MD](docs/SRS.MD) (design, called SDS in cross-references). This file is the summary — when in doubt, those two win.

**Status:** repo currently contains only `docs/` and `.claude/`. The structure below is the approved target — build into it, don't invent an alternative.

## 1. Project Overview

A full-stack note-taking app where authenticated users create, organize, search, and share rich-text notes. Core capabilities: CRUD with soft delete, user-scoped tagging, PostgreSQL full-text search with highlighting, public read-only share links, and per-note version history with restore.

## 2. Repository Structure

```
/
├── docs/                    FRS.MD, SRS.MD (design), decisions/
├── packages/shared/         ALL shared TS types + Zod schemas (single source, imported by both apps)
│   └── src/
│       ├── schemas/         zod: auth.ts, note.ts, tag.ts, share.ts, version.ts, search.ts
│       ├── types/           inferred TS types (z.infer) + API response types
│       └── constants/       limits, error codes
├── backend/
│   └── src/
│       ├── routes/          thin Express routers — validate input, call service, nothing else
│       ├── services/        business logic, one file per domain (auth, note, tag, search, share, version)
│       ├── middleware/      auth (JWT verify), error handler, validation
│       ├── lib/              prisma client, jwt, otp, fts helpers
│       └── prisma/          schema.prisma, migrations/
├── frontend/
│   └── src/
│       ├── pages/           auth, notes list, editor, search
│       ├── components/      shadcn-based UI, share modal, version drawer
│       ├── api/              TanStack Query hooks, one file per domain
│       └── stores/           Zustand (auth/session, editor state)
└── e2e/                     Playwright tests
```

## 3. Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, TanStack Query, Zustand, TipTap, shadcn/ui |
| Backend | Node.js 22, Express 5, TypeScript |
| Database | PostgreSQL 16, Prisma ORM |
| Auth | JWT access (15 min) + DB-stored, rotated refresh token (7 days) |
| Search | PostgreSQL FTS (tsvector + GIN, ts_headline) |
| Testing | Vitest (unit/integration), Supertest (API), Playwright (E2E) |
| Monorepo | pnpm workspaces |

**All dependency versions are pinned in package.json — never `@latest`.**

## 4. Key Commands

```bash
pnpm install                 # install all workspace deps
pnpm build                   # build all packages — must be 0 errors/warnings
pnpm lint --max-warnings 0   # ESLint across the monorepo
pnpm test                    # Vitest unit + integration
pnpm --filter e2e test       # Playwright E2E
pnpm --filter backend dev    # backend dev server
pnpm --filter frontend dev   # frontend dev server (Vite)
pnpm prisma migrate dev      # run inside backend/, applies schema changes
```

Run `pnpm build → pnpm lint --max-warnings 0 → pnpm test` as a checkpoint after every phase of work, before committing.

## 5. Architecture Patterns

- **Layering rule:** routes never touch Prisma directly; services never import Express types.
- Request flow: route → Zod-validates body/query with a shared schema → calls service → service talks to Prisma/lib → route shapes the response.
- One service file per domain (auth, note, tag, search, share, version) — no god-service.
- Version snapshot creation and the 50-version purge happen inside the same DB transaction as the note update (ADR-004).
- Frontend: one TanStack Query hook file per domain, query keys like `['notes', filters]`; mutations invalidate the affected keys. Auth state (access token in memory, refresh token in localStorage) lives in a Zustand store.

## 6. Coding Standards

- TypeScript strict mode everywhere; no `any` without justification.
- All external input (HTTP body/query/params) is validated at the route boundary using a Zod schema from `packages/shared`. Never trust unvalidated input in a service.
- Errors are thrown as typed domain errors in services and translated to the uniform error shape in one central error-handling middleware — no ad hoc `res.status().json()` for errors inside routes/services.
- Response shape is uniform (see §8) for every endpoint — do not deviate per-route.
- Ownership checks live in services, not routes.
- Naming: `camelCase` for variables/functions, `PascalCase` for types/components/Prisma models, files match their primary export's domain (e.g. `note.service.ts`, `note.routes.ts`).

## 7. Auth Approach

- **Access token:** JWT (HS256), 15 min TTL, payload `{ sub: userId }`, sent as `Authorization: Bearer <token>`.
- **Refresh token:** opaque random string (not a JWT), 7-day TTL, stored as a sha256 hash — raw token never persisted. Rotated on every use within a `familyId`; reuse of a revoked token revokes the whole family (theft detection).
- **Passwords:** bcrypt, cost 12. Never logged or stored in plaintext.
- **OTP (forgot password):** 6-digit numeric, bcrypt-hashed, 10 min TTL, max 5 attempts, single-use. Logged to console as `[EMAIL] OTP for <email>: <code>` — never actually emailed.
- **Auth middleware** verifies the JWT and attaches `req.userId`; it does not do ownership checks.
- **No existence leakage:** a resource owned by another user, or that doesn't exist, always returns `404 NOT_FOUND` — never `403`. Same rule for forgot-password (identical response whether the email exists or not).

## 8. API Design Conventions

REST under base path `/api`. All responses are JSON with a uniform envelope:

```jsonc
{ "data": { ... } }                                              // success
{ "data": [ ... ], "meta": { "page": 1, "limit": 20, "total": 57, "totalPages": 3 } } // lists
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "fields": [{ "path": "password", "message": "…" }] } } // error
```

`fields[]` appears only on `VALIDATION_ERROR`.

| Situation | Status | error.code |
| --- | --- | --- |
| Resource created | 201 | — |
| Read/update/action success | 200 | — |
| Delete/revoke/logout success | 204 (no body) | — |
| Zod validation failure | 400 | VALIDATION_ERROR |
| Missing/invalid/expired access token | 401 | UNAUTHORIZED |
| Bad credentials/OTP/refresh token | 401 | INVALID_CREDENTIALS / INVALID_OTP / INVALID_REFRESH_TOKEN |
| Not found or not owned | 404 | NOT_FOUND |
| Duplicate email/tag name | 409 | EMAIL_TAKEN / TAG_NAME_TAKEN |
| Unhandled error | 500 | INTERNAL_ERROR |

List endpoints share one pagination contract: `page` (default 1), `limit` (default 20, max 100), plus `sortBy`/`order` where applicable. Full endpoint list is in docs/SRS.MD §5.3.

## 9. DB Schema Summary

Prisma models (full schema in docs/SRS.MD §3):

- **User** — email (unique, lowercased), passwordHash. Owns everything else.
- **RefreshToken** — tokenHash (unique), familyId, expiresAt, revokedAt.
- **PasswordResetOtp** — otpHash, expiresAt, attemptsLeft, usedAt.
- **Note** — title, content (TipTap JSON), contentText (plain-text extract feeding FTS), deletedAt (soft delete). Indexed on `(userId, deletedAt)` and `(userId, updatedAt)`. A generated `searchVector` tsvector column + GIN index powers search.
- **Tag** — name + hex color, unique per `(userId, name)`.
- **NoteTag** — join table, composite PK `(noteId, tagId)`.
- **ShareLink** — token (unique, 32-byte random), expiresAt, revokedAt, viewCount.
- **NoteVersion** — version (monotonic per note), title, content snapshot. Unique on `(noteId, version)`; capped at 50 per note.

## 10. Testing Approach

| Level | Tool | Scope |
| --- | --- | --- |
| Unit | Vitest | services, lib (otp, jwt, fts text extraction) |
| API integration | Vitest + Supertest | every endpoint: happy path + every FRS error scenario, one named test per scenario |
| E2E | Playwright | full flow: register → login → create/tag/edit → search → share → open public link → restore version → logout |

- Tests live next to what they cover (`*.test.ts` in backend/frontend `src/`) except E2E, which lives in `/e2e`.
- Integration tests run against a separate Postgres test DB, migrated and truncated between suites.
- Coverage gate: ≥80% on new code. Run `pnpm test` before every commit.

## 11. Do NOT Do

- Do not implement: real-time collaborative editing, file/image attachments, a mobile app, OAuth/social login, note folders/nesting, or actual email sending (OTP/email output is console-only). These are explicitly out of scope.
- Do not call Prisma from a route handler, or import Express types into a service.
- Do not return `403` for ownership violations — always `404` (no existence leakage).
- Do not store or log plaintext passwords, raw refresh tokens, or raw OTPs — only their hashes.
- Do not hard-delete a `Note` on user delete — soft delete only (`deletedAt`), 30-day recovery window.
- Do not skip the version snapshot on a title/content update, and do not create one on a no-op update.
- Do not add a dependency pinned to `@latest` — pin exact versions.
- Do not bypass the shared Zod schemas by hand-rolling validation in a route.
- Do not add new response shapes — every endpoint uses the envelope in §8.

## 12. Shared Packages

`packages/shared` is the only place types/schemas are defined — both `backend` and `frontend` import from it, never duplicate it:

- `src/schemas/` — Zod schemas per domain (`auth.ts`, `note.ts`, `tag.ts`, `share.ts`, `version.ts`, `search.ts`), used for both request validation (backend) and form validation (frontend).
- `src/types/` — TS types inferred via `z.infer<>` from the schemas, plus shared API response types.
- `src/constants/` — shared limits (pagination max, title length, etc.) and error codes, so backend and frontend never hardcode the same magic number twice.

## 13. Project Tooling & Standards

- **TypeScript** — strict typing across the codebase.
- **Zod** — runtime schema validation for env vars, API inputs, and any external/untyped data.
- **ESLint** — linting and code quality rules.
- **Prettier** — consistent formatting.
- **eslint-config-prettier** — turns off ESLint format rules that conflict with Prettier.
- **Knip** — detects unused files, exports, and dependencies.
- **Husky** — git hooks (pre-commit, pre-push).
- **lint-staged** — runs ESLint + Prettier on staged files only, inside the pre-commit hook.
- **Commitlint** — enforces Conventional Commits.
- **Gitleaks** — scans for leaked secrets/credentials.
- **Vitest** (+ **@vitest/coverage-v8**) — unit and integration testing, with coverage for the ≥80% gate.
- **GitHub Actions** — CI: lint, format check, tests, gitleaks on every PR.
- **Dependabot** — automated dependency updates and vulnerability alerts.
- **EditorConfig** — consistent indentation and line endings across editors.
- **Environment pinning** — `.nvmrc` (Node 22), `packageManager` (pnpm), `.npmrc` (`engine-strict`, `save-exact`) so every machine builds identically.

Conventions:
- All commits follow Conventional Commits, format `feat(scope): description AB#ticket`.
- **Commits are human-authored — no AI/model attribution anywhere.** A commit message MUST NOT contain a co-author trailer, an AI-assistant / model / vendor name, a vendor email, or a "Generated with …" footer. The same applies to PR bodies, READMEs, and every file in the repo — nothing here carries AI attribution. Enforced by the `.husky/commit-msg` hook.
- Branches: `feature/{domain}/AB-{ticket}-{short-name}`.
- Code must pass ESLint, Prettier, and TypeScript checks before commit (enforced via Husky).
- Tests must pass before merge.
- No secrets or credentials committed — env vars go through `.env` (never committed): `DATABASE_URL`, `JWT_SECRET`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `PORT`.
- **Documentation is part of Definition of Done.** READMEs follow a hub (root) + per-package model — every fact lives in one place. At ticket close, reconcile the affected README(s) with what the ticket changed: new dependencies, features, modules/files, endpoints, commands, or env vars, plus the package README's `Status` block. The `.husky/pre-push` hook warns (non-blocking) when a push contains code changes but no README change. Rationale: [docs/superpowers/specs/2026-07-13-readme-structure-design.md](docs/superpowers/specs/2026-07-13-readme-structure-design.md).
