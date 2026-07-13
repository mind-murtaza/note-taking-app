# @app/backend

The Express 5 + TypeScript API for the Note-taking App. Owns HTTP routing, business logic, data access via Prisma, and the PostgreSQL full-text search. Talks to clients through the uniform response envelope defined in the [root README](../README.md#api-design).

> Part of the [Note-taking App](../README.md) monorepo. Root-level setup, env vars, and the API envelope/status-code contract live in the [root README](../README.md); backend-specific coding rules live in [CLAUDE.md](./CLAUDE.md).

## Status

**Ticket:** AB-1001 (scaffold)
**Implemented:** Express app factory (`createApp`) with a placeholder `GET /health` route, an env-validated server bootstrap (`server.ts` → `parseEnv` from `@app/shared`), and a **bare** Prisma setup (datasource + generator, no models). `prisma generate` succeeds against the bare schema.
**Not yet:** `routes/`, `services/`, `repositories/`, `middleware/`, `lib/`; all Prisma models + migrations; the auth, notes, tags, search, sharing, and version endpoints (AB-1002+).

## Layering (strict, one-way)

```text
HTTP request
  → routes/        validate body/query with a shared Zod schema, call ONE service
  → services/      all business logic + ownership checks; throw typed domain errors
  → repositories/  the ONLY layer that imports the Prisma client (incl. raw SQL)
  → Prisma / PostgreSQL
  → central error middleware maps thrown errors to the { error } envelope
```

Rules (see [CLAUDE.md](./CLAUDE.md) for the full list):

- Routes never import Prisma; services never import Express types.
- Ownership violations return `404 NOT_FOUND`, never `403` (no existence leakage).
- No ad hoc `res.status().json()` for errors — throw and let the error middleware format.
- The note update + version snapshot + 50-version purge is one transactional repository function (ADR-004).

## Structure

```text
backend/
├── prisma/
│   └── schema.prisma       datasource + generator (models arrive per ticket)
└── src/
    ├── index.ts            createApp() factory (+ /health placeholder)
    ├── server.ts           composition root: parseEnv → createApp → listen
    ├── index.test.ts       app/route tests
    ├── routes/             (planned) thin Express routers, one per domain
    ├── services/           (planned) business logic, one per domain
    ├── repositories/       (planned) Prisma / raw SQL access, one per domain
    ├── middleware/          (planned) auth, validation, error handler
    └── lib/                (planned) prisma client, jwt, otp, fts helpers
```

## Setup & Run

Needs a running PostgreSQL (see [root README → Local Development](../README.md#local-development)) and a `.env` (see [root README → Environment Variables](../README.md#environment-variables)). Build `@app/shared` first.

```bash
pnpm --filter @app/shared build        # build the shared contract first
pnpm --filter @app/backend dev         # tsx watch src/server.ts
pnpm --filter @app/backend build       # tsc build
pnpm --filter @app/backend test        # Vitest + (later) Supertest
```

Verify the scaffold endpoint:

```bash
curl http://localhost:3000/health
# { "data": { "status": "ok", "shared": "@app/shared" } }
```

Linting/formatting are repo-wide from the root (`pnpm lint`, `pnpm format`).

## Prisma & Database

```bash
cd backend
pnpm prisma generate                    # regenerate client after schema changes
pnpm prisma migrate dev --name <name>   # new migration (ask first — touches a real DB)
pnpm prisma studio                      # inspect the local DB
```

The schema is currently datasource + generator only. Target models (`User`, `RefreshToken`, `PasswordResetOtp`, `Note`, `Tag`, `NoteTag`, `ShareLink`, `NoteVersion`) and the full-text search design (generated `tsvector` column + GIN index, `websearch_to_tsquery`, `ts_rank`, `ts_headline`) are defined in [docs/SRS.MD §3](../docs/SRS.MD) and land with their owning tickets.

## Endpoints

The API base path is `/api` and every response uses the envelope + status codes in the [root README → API Design](../README.md#api-design). The full endpoint list per domain lives in [docs/SRS.MD §5.3](../docs/SRS.MD). Currently only `GET /health` exists (scaffold).

| Endpoint | Status | Ticket |
| --- | --- | --- |
| `GET /health` | Implemented | AB-1001 |
| `/api/auth/*` | Planned | AB-1002, AB-1003 |
| `/api/notes*`, `/api/tags*`, `/api/search` | Planned | AB-1004–AB-1007 |
| `/api/notes/:id/shares`, `/api/public/shares/:token`, `/api/notes/:id/versions*` | Planned | AB-1008, AB-1009 |

## Testing

- **Unit** (Vitest) — services and `lib/` helpers (jwt, otp, fts text extraction).
- **Integration** (Vitest + Supertest, planned) — every endpoint: happy path + every FRS error scenario, one named test per scenario, against the separate `notes_test` database (migrated + truncated between suites).

## How to Add a New Domain

1. Define/extend the Zod schema in [`@app/shared`](../packages/shared/README.md).
2. Add `repositories/<domain>.repository.ts` (Prisma access only).
3. Add `services/<domain>.service.ts` (business logic + ownership checks).
4. Add `routes/<domain>.routes.ts` (validate with the shared schema → call the service).
5. Add integration tests for the happy path and every error scenario.

## Dependencies

| Dependency | Why | What it does |
| --- | --- | --- |
| `express` | HTTP API | Routing, middleware, request/response |
| `@prisma/client` | Typed DB access | Generated client used by repositories |
| `@app/shared` | Contract reuse | Shared schemas, constants, types |
| `prisma` (dev) | Schema/migration tooling | `generate`, `migrate`, schema validation |
| `tsx` (dev) | Local TS dev | Runs `src/server.ts` in watch mode |
| `@types/express`, `@types/node` (dev) | TS types | Express + Node type definitions |

Planned (arrive with their tickets): a maintained **bcrypt** binding (password/OTP hashing, cost 12), a **JWT** library (HS256 access tokens), and **supertest** (API integration tests).
