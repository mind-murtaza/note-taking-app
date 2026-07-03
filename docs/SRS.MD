# Software Design Specification (SDS)
## Note Taking Application

**Version:** 1.0
**Related:** docs/FRS.md — every design decision here maps to an FRS requirement.

---

## 1. Tech Stack (fixed, per assignment)

| Layer | Technology | Pinned approach |
| --- | --- | --- |
| Frontend | React 19, TypeScript, Vite, TanStack Query, Zustand, TipTap, shadcn/ui | exact versions pinned in package.json |
| Backend | Node.js 22, Express 5, TypeScript | |
| Database | PostgreSQL 16, Prisma ORM | |
| Auth | JWT access (15 min) + refresh token (7 days, DB-stored, rotated) | |
| Search | PostgreSQL FTS (tsvector + GIN, ts_headline) | |
| Testing | Vitest (unit/integration), Supertest (API), Playwright (E2E) | |
| Monorepo | pnpm workspaces | |

**Rule (assignment Rule 20):** all versions pinned; never `@latest`.

---

## 2. Monorepo Layout

```
/
├── docs/                    FRS.md, SDS.md, decisions/
├── packages/shared/         ALL shared TS types + Zod schemas (Rule 11)
│   └── src/
│       ├── schemas/         zod: auth.ts, note.ts, tag.ts, share.ts, version.ts, search.ts
│       ├── types/           inferred TS types (z.infer) + API response types
│       └── constants/       limits, error codes
├── backend/
│   └── src/
│       ├── routes/          thin Express routers (validation + call service)
│       ├── services/        business logic (one per domain)
│       ├── middleware/      auth, error handler, validation
│       ├── lib/             prisma client, jwt, otp, fts helpers
│       └── prisma/          schema.prisma, migrations/
├── frontend/
│   └── src/
│       ├── pages/           auth, notes list, editor, search
│       ├── components/      shadcn-based UI, share modal, version drawer
│       ├── api/             TanStack Query hooks (one file per domain)
│       └── stores/          Zustand (auth/session, editor state)
└── e2e/                     Playwright tests
```

**Layering rule:** routes never touch Prisma directly; services never import Express types. Validation happens at the route boundary using shared Zod schemas.

---

## 3. Database Schema (Prisma)

```prisma
model User {
  id            String    @id @default(uuid())
  email         String    @unique            // stored lowercased
  passwordHash  String
  createdAt     DateTime  @default(now())
  notes         Note[]
  tags          Tag[]
  refreshTokens RefreshToken[]
  otps          PasswordResetOtp[]
}

model RefreshToken {
  id         String    @id @default(uuid())
  tokenHash  String    @unique              // sha256 of token; raw token never stored
  familyId   String                          // rotation family for reuse detection (FRS 1.3.2)
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt  DateTime
  revokedAt  DateTime?
  createdAt  DateTime  @default(now())
  @@index([userId])
  @@index([familyId])
}

model PasswordResetOtp {
  id           String    @id @default(uuid())
  userId       String
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  otpHash      String                        // bcrypt of 6-digit code
  expiresAt    DateTime                      // now + 10 min
  attemptsLeft Int       @default(5)
  usedAt       DateTime?
  createdAt    DateTime  @default(now())
  @@index([userId])
}

model Note {
  id         String     @id @default(uuid())
  userId     String
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  title      String                          // 1–200 chars (validated in Zod)
  content    Json                            // TipTap JSON document
  contentText String    @default("")         // extracted plain text, feeds FTS
  deletedAt  DateTime?                       // soft delete (FRS 2.4)
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  tags       NoteTag[]
  shares     ShareLink[]
  versions   NoteVersion[]
  @@index([userId, deletedAt])
  @@index([userId, updatedAt])
}
// Raw-SQL migration adds:
//   ALTER TABLE "Note" ADD COLUMN "searchVector" tsvector
//     GENERATED ALWAYS AS (
//       setweight(to_tsvector('english', coalesce(title,'')), 'A') ||
//       setweight(to_tsvector('english', coalesce("contentText",'')), 'B')
//     ) STORED;
//   CREATE INDEX note_search_idx ON "Note" USING GIN ("searchVector");

model Tag {
  id        String    @id @default(uuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String                            // 1–50 chars
  color     String                            // "#RRGGBB"
  createdAt DateTime  @default(now())
  notes     NoteTag[]
  @@unique([userId, name])                    // per-user, name lowercased in service layer
}

model NoteTag {
  noteId String
  tagId  String
  note   Note @relation(fields: [noteId], references: [id], onDelete: Cascade)
  tag    Tag  @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([noteId, tagId])
}

model ShareLink {
  id        String    @id @default(uuid())
  token     String    @unique                 // 32 bytes crypto.randomBytes, base64url
  noteId    String
  note      Note      @relation(fields: [noteId], references: [id], onDelete: Cascade)
  expiresAt DateTime?
  revokedAt DateTime?
  viewCount Int       @default(0)             // incremented atomically (FRS 5.4)
  createdAt DateTime  @default(now())
  @@index([noteId])
}

model NoteVersion {
  id        String   @id @default(uuid())
  noteId    String
  note      Note     @relation(fields: [noteId], references: [id], onDelete: Cascade)
  version   Int                               // monotonic per note, starts at 1
  title     String
  content   Json
  createdAt DateTime @default(now())
  @@unique([noteId, version])
  @@index([noteId, createdAt])
}
```

---

## 4. Auth Design

- **Access token:** JWT, HS256, 15 min TTL. Payload: `{ sub: userId }`. Sent as `Authorization: Bearer <token>`.
- **Refresh token:** opaque random string (not JWT), 7-day TTL, stored as sha256 hash. Returned in the JSON body (documented trade-off; httpOnly cookie is a possible hardening step, out of scope).
- **Rotation & reuse detection (FRS 1.3):** every refresh issues a new token in the same `familyId` and revokes the old one. Presenting an already-revoked token from a family revokes the entire family.
- **Password hashing:** bcrypt, cost 12.
- **OTP:** 6-digit numeric, bcrypt-hashed, 10 min TTL, 5 attempts, single-use; logged via `console.log("[EMAIL] OTP for <email>: <code>")` — never sent.
- **Auth middleware:** verifies JWT, attaches `req.userId`. Ownership checks live in services; violations surface as `NOT_FOUND` (FRS 1.6.2 — no existence leakage).

---

## 5. API Contracts

Base path: `/api`. All responses JSON.

### 5.1 Uniform response shapes

```jsonc
// Success
{ "data": { ... } }
// Success (lists)
{ "data": [ ... ], "meta": { "page": 1, "limit": 20, "total": 57, "totalPages": 3 } }
// Error
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "fields": [{ "path": "password", "message": "…" }] } }
```

`fields[]` is present only for `VALIDATION_ERROR`.

### 5.2 Status code policy (Definition of Done depends on exact match)

| Situation | Status | error.code |
| --- | --- | --- |
| Resource created | 201 | — |
| Success (read/update/action) | 200 | — |
| Delete / revoke / logout success | 204 (no body) | — |
| Zod validation failure | 400 | VALIDATION_ERROR |
| Missing/invalid/expired access token | 401 | UNAUTHORIZED |
| Bad credentials / bad or expired OTP / bad refresh token | 401 | INVALID_CREDENTIALS / INVALID_OTP / INVALID_REFRESH_TOKEN |
| Resource not found or not owned (FRS 1.6.2) | 404 | NOT_FOUND |
| Duplicate email / duplicate tag name | 409 | EMAIL_TAKEN / TAG_NAME_TAKEN |
| Unhandled server error | 500 | INTERNAL_ERROR |

### 5.3 Endpoints

**Auth (AB-1002, AB-1003)**

| Method & path | Auth | Success | Notes |
| --- | --- | --- | --- |
| POST /api/auth/register | — | 201 `{user}` | 409 EMAIL_TAKEN, 400 |
| POST /api/auth/login | — | 200 `{user, accessToken, refreshToken}` | 401 INVALID_CREDENTIALS |
| POST /api/auth/refresh | — | 200 `{accessToken, refreshToken}` | 401 INVALID_REFRESH_TOKEN |
| POST /api/auth/logout | — | 204 | idempotent (FRS 1.4.2) |
| POST /api/auth/forgot-password | — | 200 `{message}` | identical response regardless of email existence |
| POST /api/auth/reset-password | — | 200 `{message}` | body: email, otp, newPassword; 401 INVALID_OTP |

**Notes (AB-1004, AB-1005)**

| Method & path | Success | Notes |
| --- | --- | --- |
| POST /api/notes | 201 note | optional tagIds |
| GET /api/notes | 200 list+meta | ?page&limit&sortBy(createdAt\|updatedAt\|title)&order(asc\|desc)&tagIds=a,b (AND) |
| GET /api/notes/:id | 200 note | 404 if deleted/foreign |
| PATCH /api/notes/:id | 200 note | creates version if changed (FRS 6.1) |
| DELETE /api/notes/:id | 204 | soft delete; 404 if already deleted |

**Tags (AB-1006)**

| Method & path | Success | Notes |
| --- | --- | --- |
| POST /api/tags | 201 tag | 409 TAG_NAME_TAKEN |
| GET /api/tags | 200 `[{...tag, noteCount}]` | count excludes soft-deleted notes |
| PATCH /api/tags/:id | 200 tag | 409 on rename collision |
| DELETE /api/tags/:id | 204 | removes associations, notes untouched |

**Search (AB-1007)**

| Method & path | Success | Notes |
| --- | --- | --- |
| GET /api/search?q=&page=&limit= | 200 list+meta | items: `{id, titleHighlight, snippet, rank, updatedAt, tags}`; empty q → 400 |

Implementation: `websearch_to_tsquery('english', q)` against `searchVector`, ranked by `ts_rank`, highlights via `ts_headline` (`StartSel=<mark>`, `StopSel=</mark>`).

**Sharing (AB-1008)**

| Method & path | Auth | Success | Notes |
| --- | --- | --- | --- |
| POST /api/notes/:id/shares | ✅ | 201 shareLink | optional expiresAt |
| GET /api/notes/:id/shares | ✅ | 200 active links | |
| DELETE /api/shares/:shareId | ✅ | 204 | revoke |
| GET /api/public/shares/:token | — | 200 `{title, content, updatedAt}` | 404 if revoked/expired/note deleted; increments viewCount atomically (`UPDATE ... SET "viewCount" = "viewCount" + 1`) |

**Versions (AB-1009)**

| Method & path | Success | Notes |
| --- | --- | --- |
| GET /api/notes/:id/versions | 200 list+meta | newest first |
| GET /api/notes/:id/versions/:version | 200 full version | |
| POST /api/notes/:id/versions/:version/restore | 200 updated note | applies as new update (FRS 6.3) |

**Version purge (FRS 6.4):** on snapshot creation, delete versions beyond the newest 50, inside the same transaction as the note update + snapshot insert.

---

## 6. Frontend Design (AB-1010 … AB-1015)

- **Data fetching:** TanStack Query per domain; query keys `['notes', filters]`, `['note', id]`, `['tags']`, etc. Mutations invalidate affected keys.
- **Auth state:** Zustand store holds access token in memory + refresh token in localStorage (documented trade-off). Axios/fetch interceptor auto-refreshes on 401 once, then logs out.
- **Editor (AB-1012):** TipTap; autosave debounced 2 s after last keystroke, only when dirty; PATCH sends full title+content. Server-side no-op detection prevents junk versions (FRS 6.1).
- **Search UI (AB-1013):** renders server `<mark>` highlights (sanitized).
- **Routing:** public routes: /login, /register, /forgot-password, /share/:token. All else behind auth guard.

---

## 7. Testing Strategy

| Level | Tool | Scope |
| --- | --- | --- |
| Unit | Vitest | services, lib (otp, jwt, fts text extraction) |
| API integration | Vitest + Supertest | every endpoint: happy path + every FRS error scenario; one named test per spec scenario |
| E2E | Playwright | AB-1016: register → login → create/tag/edit → search → share → open public link → restore version → logout |

- Test DB: separate Postgres database, migrated + truncated between suites.
- Coverage gate: ≥80 % on new code (assignment DoD).

---

## 8. Quality Gates & Conventions

- Checkpoints after every phase: `pnpm build` (0 errors/warnings) → `pnpm lint --max-warnings 0` → `pnpm test`.
- Husky pre-commit + commitlint; commits: `feat(scope): description AB#ticket`.
- Branches: `feature/{domain}/AB-{ticket}-{short-name}`.
- Env vars via `.env` (never committed): `DATABASE_URL`, `JWT_SECRET`, `ACCESS_TOKEN_TTL=15m`, `REFRESH_TOKEN_TTL=7d`, `PORT`.

## 9. Architecture Decision Records (initial)

| ADR | Decision | Why |
| --- | --- | --- |
| ADR-001 | Opaque DB-stored refresh tokens with rotation + family reuse detection | Revocability (FRS 1.4) and theft detection; JWTs can't be revoked |
| ADR-002 | Generated `tsvector` column + GIN index | Zero-maintenance FTS, index-backed, no triggers to drift |
| ADR-003 | `contentText` extracted from TipTap JSON at write time | FTS can't parse JSON structure; extraction in shared lib keeps it testable |
| ADR-004 | Version purge inside the update transaction | Guarantees ≤50 versions invariant with no background job |
| ADR-005 | Ownership violations return 404, never 403 | FRS 1.6.2 — prevents resource-existence enumeration |
| ADR-006 | Dependency versions are chosen at implementation time and pinned exact, gated by `pnpm audit` (0 high/critical); one scaffolding ticket (AB-1001) establishes the tooling baseline | Prevents stale or vulnerable version pins baked into the spec; gives every later ticket one enforced, audited foundation |

---

## 10. Project Scaffolding & Tooling (AB-1001)

Foundational ticket: stands up the pnpm monorepo skeleton and all quality tooling so that `pnpm build → lint → test` run green on an empty tree, and every later ticket (AB-1002+) builds on a working, enforced baseline. No domain logic here — this builds the workshop, not the products.

### 10.1 Deliverables

- **Workspace skeleton** — root `package.json` (private) + `pnpm-workspace.yaml`; the four packages (`packages/shared`, `backend`, `frontend`, `e2e`), each with its own `package.json` + `tsconfig.json` and a placeholder entry so builds pass.
- **TypeScript** — root `tsconfig.base.json` (strict mode); each package extends it; `backend`/`frontend` resolve `@app/shared` via the workspace protocol.
- **Zod** — installed in `packages/shared`; an env-validation module that validates `process.env` (the pattern reused for all later config).
- **ESLint (flat config) + Prettier** — TypeScript + React rules; `eslint-config-prettier` disables format rules that would conflict with Prettier.
- **Knip / Husky / Commitlint / Gitleaks** — unused-code detection; git hooks; Conventional-Commit enforcement; secret scanning.
- **lint-staged** — pre-commit hook runs ESLint + Prettier on staged files only.
- **Vitest + @vitest/coverage-v8** — root + per-package config; one trivial passing test per package; coverage reporting wired for the ≥80% gate (§7).
- **Prisma (bare init)** — installed; `schema.prisma` with datasource + generator blocks only (no models — models are defined in their owning tickets). `prisma generate` works from day one.
- **Local Postgres** — `docker-compose.yml` providing Postgres 16 with a dev database and a separate test database (per §7).
- **Environment pinning** — `.editorconfig`, `.nvmrc` (Node 22), `packageManager` (pnpm), `.npmrc` (`engine-strict=true`, `save-exact=true`).
- **GitHub Actions** — CI on every PR: install → build → lint → format:check → test → gitleaks.
- **Dependabot** — `.github/dependabot.yml` for the `npm` and `github-actions` ecosystems.

### 10.2 Acceptance Criteria (Definition of Done)

| # | Criterion |
| --- | --- |
| AC1 | `pnpm install` succeeds; every dependency pinned to an exact version (no `^`/`~`/`@latest`); `save-exact=true` enforced. |
| AC2 | `pnpm build` → 0 errors, 0 warnings across all packages. |
| AC3 | `pnpm lint --max-warnings 0` → clean. |
| AC4 | `pnpm format:check` → clean. |
| AC5 | `pnpm test` → green; coverage reporting produces output. |
| AC6 | `pnpm knip` → no unused files, exports, or dependencies. |
| AC7 | Husky: a non-Conventional commit message is rejected (commitlint); a planted secret is blocked (gitleaks); staged files are linted (lint-staged). |
| AC8 | `pnpm audit --audit-level=high` → 0 high/critical vulnerabilities. |
| AC9 | `@app/shared` is importable from both `backend` and `frontend` (verified by a placeholder import). |
| AC10 | Strict TypeScript proven: a deliberate type error fails `pnpm build`. |
| AC11 | `docker compose up` starts Postgres 16 with dev + test databases reachable via `DATABASE_URL`. |
| AC12 | `prisma generate` succeeds against the bare schema. |
| AC13 | GitHub Actions workflow runs install → build → lint → format → test → gitleaks on a PR and passes. |
| AC14 | Dependabot config present for `npm` + `github-actions`. |

### 10.3 Version & Vulnerability Policy

Exact versions are **not** fixed in this document; they are selected at implementation time and pinned exactly in each `package.json`. `pnpm audit --audit-level=high` must report zero high/critical advisories at implementation (AC8) — this is verified, not assumed. Rationale in ADR-006.

### 10.4 Out of Scope

No domain logic (auth, notes, tags, search, share, version) and no Prisma models — those belong to AB-1002 and later. No deployment/CD and no application Dockerfiles; the docker-compose file is for local Postgres only.