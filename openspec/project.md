# Project Context

Context for AI-assisted, spec-driven work in this repo. Authoritative sources: [docs/FRS.MD](../docs/FRS.MD) (requirements), [docs/SRS.MD](../docs/SRS.MD) (design, "SDS" in cross-references), [AGENTS.md](../AGENTS.md) (working summary). Requirement IDs (FRS x.y.z) and ticket IDs (AB-10xx) are stable — reference them in proposals, tasks, commits, and PRs.

## What This Product Is

A full-stack note-taking app: authenticated users create, organize, search, and share rich-text notes. Six domains — auth, notes (CRUD + soft delete), tags, PostgreSQL full-text search, public share links, version history with restore. Actors: Visitor (register/login/reset/view shared links), User (full access to own data only, never another user's), System (token expiry, version purge, share expiry).

**Out of scope (implementing any is a violation):** real-time collaboration, file/image attachments, mobile app, OAuth/social login, note folders/nesting, real email sending (OTP goes to console only).

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite, TanStack Query, Zustand, TipTap, shadcn/ui (Radix + Tailwind), Sonner, lucide-react |
| Backend | Node.js 22, Express 5, TypeScript |
| Database | PostgreSQL 16, Prisma ORM |
| Auth | JWT access (15 min, HS256) + opaque rotated refresh token (7 days, sha256-hashed, family reuse detection) |
| Search | PostgreSQL FTS — generated tsvector column, GIN index, websearch_to_tsquery, ts_headline |
| Testing | Vitest, Supertest, Playwright |
| Monorepo | pnpm workspaces: `packages/shared`, `backend`, `frontend`, `e2e` |

All dependency versions pinned exactly — never `@latest`.

## Architectural Constraints

- **Backend layering (strict one-way):** route → service → repository → Prisma/DB. Routes validate (shared Zod schema) and call one service; services hold all business logic and ownership checks; `repositories/` is the only layer that imports Prisma (including raw SQL). One file per domain at every layer.
- **Atomic writes:** note update + version snapshot + 50-version purge run in one `prisma.$transaction`, exposed as a single repository function (ADR-004).
- **Errors:** services/repositories throw typed domain errors; one central middleware maps them to the uniform envelope. No ad hoc `res.status().json()`.
- **Response contract:** every endpoint uses `{ data }` / `{ data, meta }` / `{ error: { code, message, fields? } }` with the exact status-code table in AGENTS.md §8 — Definition of Done depends on exact match.
- **No existence leakage (FRS 1.6.2):** foreign or missing resources always return 404, never 403. Forgot-password responds identically whether the email exists or not.
- **Secrets:** passwords bcrypt cost 12; refresh tokens and OTPs stored only as hashes; nothing sensitive logged.
- **Shared package:** all Zod schemas, inferred types, constants, and error codes live in `packages/shared` — backend and frontend import them, never duplicate them.
- **Frontend:** server state only via TanStack Query (one hook file per domain); Zustand for client/UI state only; components composed from shadcn `components/ui/` primitives; Tailwind utilities only (no CSS modules/styled-components); server-provided `<mark>` highlights rendered sanitized.
- **Soft delete:** notes get `deletedAt`, 30-day recovery window, excluded from reads/search/shares; never hard-deleted.

## Team Conventions

- **Commits:** Conventional Commits — `feat(scope): description AB#ticket` (also `fix`, `chore`, `test`, `refactor`); scope = domain (`auth`, `note`, `tag`, `search`, `share`, `version`). One logical change per commit.
- **Branches:** `feature/{domain}/AB-{ticket}-{short-name}`; never commit directly to `main`.
- **Code principles:** DRY, KISS, YAGNI everywhere; SOLID applied to components/services. Extract shared logic to `lib/` (backend-only) or `packages/shared` (cross-app) — never copy-paste.
- **Naming:** `camelCase` variables/functions, `PascalCase` types/components/Prisma models; files match their domain (`note.service.ts`, `note.repository.ts`, `note.routes.ts`).
- **Tooling:** ESLint, Prettier, Knip, Husky (pre-commit/pre-push), Commitlint, Gitleaks, GitHub Actions CI (lint, format, tests, gitleaks per PR), Dependabot.
- **Env:** `.env` never committed — `DATABASE_URL`, `JWT_SECRET`, `ACCESS_TOKEN_TTL`, `REFRESH_TOKEN_TTL`, `PORT`.

## Quality Standards

- Gate order before every commit / task completion: `pnpm build` (0 errors/warnings) → `pnpm lint --max-warnings 0` → `pnpm test`. Fix a red step before moving on.
- TypeScript strict mode; no `any` without justification.
- Every FRS scenario (happy path + every error scenario) gets one named integration test (Vitest + Supertest). Unit tests cover services and lib helpers; Playwright E2E covers the full user journey.
- Integration tests run against a separate Postgres test DB, migrated and truncated between suites.
- Coverage ≥80% on new code.
- Tests must pass before merge; commits must pass ESLint/Prettier/TS checks (enforced via Husky).
