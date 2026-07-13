# README Structure & Maintenance — Design

**Date:** 2026-07-13
**Ticket:** AB-1017 — branch `feature/docs/AB-1017-readme-structure`, PR into `dev`
**Status:** Approved
**Scope:** Documentation structure only. No product/domain behavior. Relates to the docs concern that every package should carry its own README and that READMEs stay current per ticket.

---

## 1. Problem

The repo has one root `README.md` (~674 lines) that is comprehensive but duplicates per-package detail (per-package dependency tables, run instructions, filtered commands, DB detail). There are no per-package READMEs. As domain tickets (AB-1002+) land, a single monolithic README will keep growing and drift out of sync with the code, and per-package context has nowhere to live.

We want: a root README plus a README in each of the four workspace packages (`backend`, `frontend`, `e2e`, `packages/shared`), with each fact living in exactly one place, and a mechanism that keeps every README accurate as tickets ship.

## 2. Decisions

Three decisions, settled during brainstorming:

1. **Content split — root = hub, packages = deep.** The root README is a project hub (whole-picture, cross-cutting, links out). Each package README owns the deep, package-specific detail. Each fact lives in exactly one place; no duplication across READMEs.
2. **Update cadence — DoD convention + Status blocks.** A rule in AGENTS.md / CLAUDE.md makes README reconciliation part of every ticket's Definition of Done. Each package README carries a Status block that is updated per ticket. No new tooling.
3. **Audience — both evaluator and developer.** The root README leans evaluator-facing (scope, architecture, decisions, roadmap, quality). Package READMEs lean developer-facing (get productive in this package fast).

## 3. The five READMEs

| README | Role | Leans toward |
|---|---|---|
| Root `README.md` | Hub — whole-picture, cross-cutting, navigation | Evaluator |
| `backend/README.md` | Deep — how to work in the backend | Developer |
| `frontend/README.md` | Deep — how to work in the frontend | Developer |
| `e2e/README.md` | Deep — how to run/write E2E | Developer |
| `packages/shared/README.md` | Deep — the shared contract package | Developer |

## 4. Content division (root vs. packages)

### Root README keeps (cross-cutting)
- Project Status (high-level only)
- Product Scope
- Core Features (product-level)
- Architecture overview (backend flow, frontend flow, shared contract)
- Full Repository tree
- Whole Tech Stack table
- Monorepo-wide setup: install + docker
- Environment Variables (monorepo-wide; backend README links to it)
- Root-only commands
- API envelope + status-code table (shared contract, referenced by both apps)
- Testing overview
- Quality Gates
- Git Workflow
- Out of Scope
- Roadmap
- Authoritative References

### Root hands off to package READMEs (root keeps a one-line pointer + link)
- Per-package dependency rationale tables → each package README
- Per-package run/dev instructions (run backend, run frontend, run Playwright) → each package README
- Per-package filtered commands (`pnpm --filter …`) → each package README
- Deep DB / Prisma detail (models, FTS, generate/migrate) → `backend/README.md`
- Deep endpoint list → `backend/README.md` (envelope/status table stays in root)

Net effect: the root README shrinks and becomes a navigable hub.

## 5. Package README outlines

Every package README opens with the same **Status block** (see §6), then package-specific sections.

### `packages/shared/README.md`
- Purpose (single source of contracts)
- Status block
- What lives here (`schemas/`, `types/`, `constants/`)
- Build step + why it must build before backend/frontend dev (`@app/shared` dist)
- How to add a schema / type / constant
- Dependencies (`zod`)
- Rule: both apps import from `@app/shared`, never duplicate

### `backend/README.md`
- Purpose
- Status block
- Backend layering (route → service → repository → Prisma) + rules
- `backend/src` directory structure
- Setup & run (env it needs, dev server, `/health` check)
- Prisma & database (schema, generate, migrate, models, FTS)
- Endpoints (deep list; envelope → link to root)
- Testing (Vitest + Supertest, `notes_test` DB)
- Dependencies table (current + planned)
- How to add a new domain (schema in shared → route → service → repository)

### `frontend/README.md`
- Purpose
- Status block
- Frontend flow (page → component → TanStack Query hook → API client; Zustand for client state)
- `frontend/src` directory structure
- Setup & run (build shared first, Vite dev, preview)
- State management (query keys, Zustand stores)
- UI system (shadcn/ui, Radix, Tailwind, lucide-react, Sonner)
- Testing (Vitest component tests)
- Dependencies table (current + planned)
- Conventions (one hook file per domain, sanitized `<mark>` highlights)

### `e2e/README.md`
- Purpose
- Status block
- What it covers (register → login → create/tag/edit → search → share → restore → logout)
- Prerequisites (backend + frontend + `notes_test` running)
- Setup & run (Playwright install + run)
- `e2e/tests` structure
- Dependencies (`@playwright/test`)
- Conventions (one spec per journey)

## 6. Status block format

Fixed format at the top of each package README:

```markdown
## Status
**Ticket:** AB-1001 (scaffold)
**Implemented:** <features shipped in this package>
**Not yet:** <features pending>
```

At the current scaffold stage every package's Status reflects "placeholder / toolchain only".

## 7. Update mechanism — change-driven, per ticket

README updates are **not** speculative. At ticket completion (part of Definition of Done, before the final commit/PR), review the ticket's actual changes and map each change type to the README section it affects:

| What changed in the ticket | README section to update | Which README |
|---|---|---|
| New dependency added | Dependency table (move "Planned" → current, with why/what) | Package README (+ root Tech Stack if a new technology) |
| New feature implemented | Feature/behavior section + Status "Implemented" | Package README (+ root Core Features / Roadmap tick) |
| New module / directory / file group | Directory-structure section | Package README (+ root Repository tree if top-level) |
| New endpoint / route | Endpoints section | `backend/README.md` |
| New command / script | Commands section | Package README (+ root if a root script) |
| New env var | Environment Variables | Root (backend README links to it) |
| Anything now done that was "Not yet" | Status block: "Not yet" → "Implemented", bump **Ticket:** line | Package README |

**Flow at ticket close:** check the diff → for each change type above, update the matching section → update the Status block.

**Principle:** never ahead (no speculative docs), never behind (enforced by DoD). READMEs grow exactly in step with the tickets.

### 7.1 Automated trigger — Husky `pre-push` warning

To make the DoD hard to forget, a `.husky/pre-push` hook fires the reminder at push time (i.e. right before a PR):

- It inspects the commit range being pushed. If that range changes code under `backend/`, `frontend/`, `packages/shared/`, or `e2e/` (`src/` or `prisma/`) **but** changes no `README.md`, it prints a reminder about the README DoD.
- **Warning only — it never blocks the push** (always exits 0). This keeps WIP pushes unobstructed while making the omission visible.
- Matches the existing hook style (plain shell, `command -v` guards, non-blocking gitleaks precedent in `pre-commit`).

## 8. DoD rule wording

Add to AGENTS.md §13 (Conventions) and CLAUDE.md:

> Definition of Done for every ticket includes reconciling the affected README(s) with what the ticket changed — new dependencies, features, modules/files, endpoints, commands, or env vars — and updating each package README's Status block accordingly.

## 9. Out of scope

- No **blocking** README-drift enforcement. The `pre-push` hook (§7.1) warns only; it never fails a push, and there is no CI gate on README freshness. A hard block was considered and rejected as too noisy for a docs concern.
- No changes to product/domain behavior, FRS requirements, or the openspec change flow.

## 10. Implementation notes

- Slim the root README per §4 (move per-package detail out, leave one-line pointers + links).
- Create the four package READMEs per §5, each opening with the Status block from §6 reflecting the current scaffold state.
- Add the DoD rule (§8) to AGENTS.md §13 and CLAUDE.md.
- Add the `.husky/pre-push` warning hook (§7.1).
- Verify all internal links resolve and no fact is duplicated across two READMEs; `pnpm format:check` clean; hook is non-blocking.
- Ship on branch `feature/docs/AB-1017-readme-structure`, PR into `dev`.
