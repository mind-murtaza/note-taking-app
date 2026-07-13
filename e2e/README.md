# @app/e2e

End-to-end tests for the Note-taking App, driven by Playwright against the real backend + frontend running together. Covers the full user journey as a black box — the last line of defense before merge.

> Part of the [Note-taking App](../README.md) monorepo. Root-level setup, tech stack, and workflow live in the [root README](../README.md).

## Status

**Ticket:** AB-1001 (scaffold)
**Implemented:** Playwright config (`playwright.config.ts`, `testDir: ./tests`), a placeholder smoke spec (`tests/smoke.spec.ts`), and a `tsc --noEmit` type-check build.
**Not yet:** the full journey — register → login → create/tag/edit → search → share → open public link → restore version → logout. This lands in AB-1016.

## What It Covers (target)

One end-to-end journey exercising every domain in sequence:

```text
register → login → create note → tag note → edit note
        → search → share (open public link, no auth) → restore version → logout
```

## Structure

```text
e2e/
├── playwright.config.ts     Playwright config (testDir: ./tests)
└── tests/
    └── smoke.spec.ts        placeholder; full journey specs arrive in AB-1016
```

## Prerequisites

E2E runs against live services, so before running the suite you need:

1. PostgreSQL up (the `notes_test` database — see [root README → Local Development](../README.md#local-development)).
2. The **backend** running (see [backend/README.md](../backend/README.md#setup--run)).
3. The **frontend** running (see [frontend/README.md](../frontend/README.md#setup--run)).

## Setup & Run

```bash
pnpm --filter @app/e2e exec playwright install   # one-time: browser binaries
pnpm --filter @app/e2e test                      # playwright test
pnpm --filter @app/e2e build                      # tsc --noEmit type-check
```

## Conventions

- One spec file per journey/flow; keep specs black-box (drive the UI, assert on what the user sees).
- Tests live under `e2e/tests/` — the only tests that live outside a package's `src/`.

## Dependencies

| Dependency | Why | What it does |
| --- | --- | --- |
| `@playwright/test` (dev) | Browser-level E2E | Runs full user journeys in real browser contexts |
