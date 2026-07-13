# @app/frontend

The React 19 + TypeScript + Vite single-page app for the Note-taking App. Renders the auth, notes, editor, search, and sharing UI; talks to the backend through TanStack Query hooks and reuses the Zod schemas from `@app/shared` for form validation.

> Part of the [Note-taking App](../README.md) monorepo. Root-level setup, tech stack, and the API envelope contract live in the [root README](../README.md); frontend-specific coding rules live in [CLAUDE.md](./CLAUDE.md).

## Status

**Ticket:** AB-1001 (scaffold)
**Implemented:** Vite + React 19 placeholder app entry (`src/main.tsx` rendering a placeholder `App`) that imports from `@app/shared` to prove the workspace wiring.
**Not yet:** pages, shadcn/ui components, TanStack Query hooks (`api/`), Zustand stores, the TipTap editor, routing, and the auth guard. These arrive with AB-1010+.

## Data & State Flow

```text
React page (pages/)
  → composed components (components/) built from shadcn ui/ primitives
  → TanStack Query hook (api/<domain>.ts)   ← server state lives here only
  → API client → backend { data } / { data, meta } / { error } envelope
  → Zustand (stores/)                        ← client/UI state only (auth, editor)
```

Rules (see [CLAUDE.md](./CLAUDE.md) for the full list):

- All server data goes through TanStack Query — never `fetch`/`axios` directly in a component, never cached in Zustand or component state.
- One hook file per domain in `api/`; query keys are arrays (`['notes', filters]`, `['note', id]`); mutations invalidate the keys they affect.
- Zustand holds only client state: auth session (access token in memory, refresh token in localStorage) and editor state.
- Forms reuse `@app/shared` Zod schemas — never a duplicated schema.
- Server-provided `<mark>` search highlights are rendered **sanitized** — never raw HTML.

## Structure

```text
frontend/
├── index.html              Vite entry HTML
├── vite.config.ts          Vite + React plugin config
└── src/
    ├── main.tsx            React composition root (placeholder App)
    ├── app.test.ts         placeholder test
    ├── pages/              (planned) auth, notes list, editor, search, share
    ├── components/         (planned) app components + ui/ (shadcn primitives)
    ├── api/                (planned) TanStack Query hooks, one file per domain
    └── stores/             (planned) Zustand stores (auth/session, editor)
```

## Setup & Run

Build `@app/shared` first so its `dist/` exports resolve.

```bash
pnpm --filter @app/shared build        # build the shared contract first
pnpm --filter @app/frontend dev        # Vite dev server
pnpm --filter @app/frontend build      # tsc --noEmit && vite build
pnpm --filter @app/frontend preview    # preview a production build
pnpm --filter @app/frontend test       # Vitest (component/unit)
```

Linting/formatting are repo-wide from the root (`pnpm lint`, `pnpm format`).

## UI System (planned)

- **shadcn/ui** primitives in `components/ui/` (Radix + Tailwind) — owned source, edited only for theme tokens.
- App components in `components/` composed from those primitives.
- **Tailwind** utility classes only (with the `cn()` helper); no CSS modules/styled-components/inline `style=`.
- **lucide-react** icons only; **Sonner** for toasts.

## Testing

- **Unit/component** (Vitest) — components and hooks.
- **E2E** across the full journey lives in the separate [`e2e/`](../e2e/README.md) package (Playwright).

## Dependencies

| Dependency | Why | What it does |
| --- | --- | --- |
| `react`, `react-dom` | UI runtime | Components + browser rendering |
| `@app/shared` | Contract reuse | Shared schemas, constants, types |
| `vite` (dev) | Dev server + build | Fast dev server, bundling |
| `@vitejs/plugin-react` (dev) | React support in Vite | React transform + Fast Refresh |
| `@types/react`, `@types/react-dom` (dev) | TS types | React + DOM type definitions |

Planned (arrive with their tickets): `@tanstack/react-query` (server state), `zustand` (client state), `@tiptap/*` (rich-text editor), `tailwindcss` + `@radix-ui/*` + shadcn/ui components (UI system), `lucide-react` (icons), `sonner` (toasts).
