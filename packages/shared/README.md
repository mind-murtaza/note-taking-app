# @app/shared

The single source of truth for contracts shared between `backend` and `frontend`: Zod schemas, the TypeScript types inferred from them, and shared constants/error codes. Nothing here depends on either app; both apps depend on this package and import from `@app/shared` (never a deep path, never a duplicated definition).

> Part of the [Note-taking App](../../README.md) monorepo. Root-level setup, tech stack, and workflow live in the [root README](../../README.md); package-specific rules live in [CLAUDE.md](./CLAUDE.md).

## Status

**Ticket:** AB-1001 (scaffold)
**Implemented:** package skeleton, the `@app/shared` entry point (`src/index.ts`), and the Zod-based environment validation pattern (`parseEnv` in `src/env.ts`) reused by the backend bootstrap.
**Not yet:** domain schemas (`auth`, `note`, `tag`, `share`, `version`, `search`), inferred types (`z.infer`), and shared constants/error codes. These arrive with AB-1002+.

## What Lives Here

```text
packages/shared/src/
├── index.ts        Package entry — re-exports everything consumers import
├── env.ts          Zod env schema + parseEnv() (the pattern for all config)
├── env.test.ts     Env validation tests
├── schemas/        (planned) Zod schemas, one file per domain
├── types/          (planned) types inferred via z.infer + API envelope types
└── constants/      (planned) limits (pagination, title length) + error codes
```

- **`schemas/`** — the only definition of a valid request body/query anywhere in the repo. Backend validates requests with them; frontend validates forms with the same ones.
- **`types/`** — types derived from schemas with `z.infer<typeof Schema>` (never hand-written interfaces that can drift), plus API envelope types (`ApiSuccess<T>`, `ApiListSuccess<T>`, `ApiError`).
- **`constants/`** — shared limits and the `error.code` string union, so no magic number/string is duplicated across apps.

## Build

`@app/shared` compiles to `dist/` (its `main`/`types` point there). **Build it before running the backend or frontend dev servers**, and rebuild whenever its exports change:

```bash
pnpm --filter @app/shared build     # tsc -> dist/
pnpm --filter @app/shared test      # Vitest
```

`pnpm build` at the repo root builds this package (and the others) recursively.

## How to Add a Shared Item

1. **Schema** — add `src/schemas/<domain>.ts`, define the Zod schema(s) (e.g. `createNoteSchema`), export them.
2. **Type** — in `src/types/<domain>.ts`, derive with `z.infer<typeof someSchema>`.
3. **Constant** — add to the relevant `src/constants/` file; never inline the value in an app.
4. Re-export it from `src/index.ts` so consumers import from `@app/shared`.
5. Rebuild (`pnpm --filter @app/shared build`) before using it elsewhere, and update both `backend` and `frontend` call sites in the same change if the shape affects an existing endpoint.

## Rule: Never Duplicate What's Here

If a schema, type, or constant needs to exist in more than one package, it belongs here — not copy-pasted at each call site. One schema, two consumers. Full conventions: [CLAUDE.md](./CLAUDE.md).

## Dependencies

| Dependency | Why | What it does |
| --- | --- | --- |
| `zod` | Runtime validation + type inference | Defines env validation now, and API/form schemas for later tickets |
