# backend/CLAUDE.md

Scoped rules for `/backend`. See root [AGENTS.md](../AGENTS.md) and [CLAUDE.md](../CLAUDE.md) first — this only adds backend-specific detail.

## Commands

```bash
pnpm --filter backend dev              # start Express dev server
pnpm --filter backend build            # tsc build
pnpm --filter backend test             # Vitest unit + Supertest integration
pnpm --filter backend lint             # ESLint, this package only
pnpm --filter backend prisma migrate dev --name <name>   # new migration, ask first
pnpm --filter backend prisma studio    # inspect local DB
pnpm --filter backend prisma generate  # regenerate client after schema.prisma changes
```

## Framework Patterns

- Express 5 router per domain in `routes/`; each route: validate with a shared Zod schema → call one `services/*.ts` function → return the uniform response envelope. No logic beyond that.
- `services/` holds all business logic, one file per domain (auth, note, tag, search, share, version). Services call `repositories/*.ts` only — never Prisma directly.
- `repositories/` — one file per domain/model. **The only layer allowed to import the Prisma client** (including raw SQL via `prisma.$queryRaw`). Thin data-access functions only (`findById`, `create`, `update`, `softDelete`, ...) — no business logic, no ownership checks.
- `lib/` holds framework-agnostic helpers (prisma client singleton, jwt sign/verify, otp generation, fts text extraction). Only `repositories/` uses the prisma client from `lib/`; services use the jwt/otp helpers directly since those aren't DB access.
- `middleware/auth.ts` verifies the JWT and sets `req.userId`; it never checks resource ownership — that's the service's job.
- One central error-handling middleware translates thrown domain errors into the `{ error: { code, message, fields? } }` shape. Services/repositories throw typed errors; they don't format responses.
- An atomic multi-step write (note update + version snapshot + 50-version purge) is exposed as a single repository function wrapping its own `prisma.$transaction` — the service calls it once, never chains separate repository calls for it.
- Search queries use `websearch_to_tsquery` against the generated `searchVector` column, and the share-link view-count increment uses a raw atomic `UPDATE` — both live in `repositories/`, never a raw `LIKE`/`ILIKE` scan, and never in a service.

## Code Principles

- **DRY** — if the same query, validation, or rule shows up in two services or two repositories, extract it: a shared helper in `lib/` for backend-only reuse, or up into `packages/shared` if frontend needs it too. Never copy-paste a repository query or a service rule.
- **KISS** — implement the simplest thing that satisfies the FRS requirement. Don't add a config flag, generic layer, or extra abstraction the current 6 domains don't need.
- **YAGNI** — don't build for hypothetical futures (swappable ORM, multi-tenancy, pluggable auth strategies). The repository layer exists to isolate Prisma/raw SQL from business logic — not to prep for swapping databases. Build only what FRS/SDS ask for.

## Anti-Patterns to Avoid

- Don't import `PrismaClient` anywhere outside `repositories/` — not in routes, services, or middleware.
- Don't put ownership/authorization checks or algorithms in a repository — that belongs in the service.
- Don't hand-roll input validation; every route body/query must go through a `packages/shared` Zod schema, and only in `routes/`.
- Don't return `403` anywhere — unauthorized/foreign resources are always `404`.
- Don't store a raw refresh token or raw OTP — only their hashes, ever.
- Don't split an atomic multi-step write across multiple repository calls from a service — wrap it in one transactional repository function.
- Don't call `res.json()`/`res.status()` for errors inside a route, service, or repository — throw and let the error middleware handle it.
- Don't add a layer, helper, or config option "for later" — that's a YAGNI violation, not foresight.
