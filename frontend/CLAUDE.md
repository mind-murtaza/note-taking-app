# frontend/CLAUDE.md

Scoped rules for `/frontend`. See root [AGENTS.md](../AGENTS.md) and [CLAUDE.md](../CLAUDE.md) first — this only adds frontend-specific detail.

## Commands

```bash
pnpm --filter frontend dev            # Vite dev server
pnpm --filter frontend build          # production build
pnpm --filter frontend test           # Vitest (component/unit)
pnpm --filter frontend exec eslint .  # ESLint, this package only
pnpm --filter frontend preview        # preview a production build locally
```

## UI Foundation

- `components/ui/` — shadcn CLI-generated primitives (Button, Input, Dialog, Select, Tabs, Sonner, ...), which wrap Radix UI primitives with Tailwind styling. Treat as owned source, not a dependency: edit only for theme tokens, never for behavior.
- `components/` — app-specific composed components (ShareModal, VersionDrawer, NoteCard, TagPicker, ...) built from `components/ui/` primitives. Feature logic lives here, not in `ui/`.
- **Toasts:** Sonner (`sonner` package) via a `components/ui/sonner.tsx` wrapper and `toast()` calls — not shadcn's legacy `useToast`/`Toast`.
- **Icons:** `lucide-react` only, imported individually (`import { Trash2 } from "lucide-react"`) — never a second icon set.
- **Styling:** Tailwind utility classes only — no CSS modules, styled-components, or inline `style=`. Use the `cn()` helper (clsx + tailwind-merge) for conditional/merged classes. Design tokens (colors, radii, spacing) live in `tailwind.config`/the shadcn theme, never hardcoded hex values in a component.

## Component & State Management Patterns

- All server data goes through TanStack Query, one hook file per domain in `api/` (e.g. `api/notes.ts` exports `useNotes`, `useNote`, `useCreateNote`, ...). Query keys are arrays like `['notes', filters]`, `['note', id]`, `['tags']`.
- Mutations invalidate the query keys they affect — no manual refetch calls, no duplicating server state into component state.
- Zustand (`stores/`) holds only client/UI state: auth session (access token in memory, refresh token in localStorage — documented trade-off) and editor state. Never cache server data in a Zustand store.
- The TipTap editor autosaves: debounce 2s after the last keystroke, only when the document is dirty, and send full title+content on save.
- Public routes (`/login`, `/register`, `/forgot-password`, `/share/:token`) render outside the auth guard; everything else requires it.
- Search result highlights come from the server (`<mark>` tags in the response) — render them, sanitized, don't re-implement highlighting client-side.

## Code Principles

- **DRY** — a UI pattern used on 2+ pages (empty state, confirm-delete dialog, pagination controls) becomes a component in `components/`, not a copy-paste block.
- **KISS** — the simplest component/hook that satisfies the FRS requirement. No abstraction layer, render-prop, or generic wrapper the current pages don't need.
- **YAGNI** — don't build for hypothetical future needs (theming system, i18n, plugin architecture). Build only what FRS/SDS ask for.
- **SOLID**, applied to components:
  - *Single responsibility* — a component either orchestrates (fetches data, composes children) or renders (pure presentation), not both.
  - *Open/closed* — extend a `ui/` primitive via props/composition (`asChild`, wrapping); never edit its internals to fit one call site.
  - *Liskov substitution* — a specialized variant (e.g. `TagBadge` vs. generic `Badge`) must honor the same prop contract callers already expect.
  - *Interface segregation* — small, focused prop types; don't pass a whole `note` object to a component that only needs `title`.
  - *Dependency inversion* — components depend on hooks (`useNotes()`), never directly on `fetch`/`axios` or a concrete client.

## Anti-Patterns to Avoid

- Don't call `fetch`/`axios` directly in a component — always go through a TanStack Query hook.
- Don't duplicate a Zod schema for form validation — import it from `packages/shared`.
- Don't put server data (notes, tags, search results) in Zustand or component state as a cache.
- Don't build a new primitive when a `components/ui/` one covers it, and don't hand-edit a generated primitive's internals.
- Don't mix in a second icon library — lucide-react only.
- Don't use CSS modules, styled-components, or inline `style=` — Tailwind utilities + `cn()` only.
- Don't skip the auth-refresh interceptor pattern (auto-refresh once on 401, then logout) with ad hoc 401 handling in individual hooks.
- Don't render raw/unsanitized HTML from the editor or search highlights.
