# packages/shared/CLAUDE.md

Scoped rules for `/packages/shared`. See root [AGENTS.md](../../AGENTS.md) first — this only adds detail specific to this package.

## What Exists Here

- `src/schemas/` — Zod schemas, one file per domain: `auth.ts`, `note.ts`, `tag.ts`, `share.ts`, `version.ts`, `search.ts`. These are the only definition of what a valid request body/query looks like anywhere in the repo.
- `src/types/` — TypeScript types inferred from the schemas via `z.infer<typeof Schema>`, plus shared API response/envelope types (`ApiSuccess<T>`, `ApiListSuccess<T>`, `ApiError`).
- `src/constants/` — shared limits (title max length, pagination default/max, tag name max length, etc.) and the `error.code` string union (`VALIDATION_ERROR`, `NOT_FOUND`, `EMAIL_TAKEN`, ...).

Both `backend` and `frontend` depend on this package and import from it directly — nothing here depends on either of them.

## Rule: Never Duplicate What's Already Here

- Before writing a new Zod schema, type, or constant in `backend` or `frontend`, check `packages/shared` first. If it exists, import it.
- If a value needs to exist in more than one package (a limit, an error code, a shape), it belongs here, not copy-pasted at each call site.
- `backend` validates requests with these schemas; `frontend` validates forms with the same schemas. One schema, two consumers — never two schemas for the same shape.
- If you find a schema/type/constant already duplicated elsewhere in the repo, that's a bug: move the definition here and update both call sites to import it.

## How to Add a New Shared Item

1. **New domain schema:** add `src/schemas/<domain>.ts`, define the Zod schema(s) (e.g. `createNoteSchema`, `updateNoteSchema`), and export them.
2. **New type:** in `src/types/<domain>.ts`, derive it with `z.infer<typeof someSchema>` rather than hand-writing an interface that can drift from the schema.
3. **New constant:** add it to the relevant file in `src/constants/` (or create one for a new domain) — never inline a magic number/string in `backend` or `frontend`.
4. Export the new schema/type/constant from the package's entry point (`src/index.ts`) so consumers import from `@app/shared`, not a deep path.
5. Run `pnpm --filter shared build && pnpm --filter shared test` before using the new export elsewhere, and update both `backend` and `frontend` call sites in the same change if the shape affects an existing endpoint.
