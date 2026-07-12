import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit + integration tests run under Vitest across the three code packages.
// E2E lives in `e2e/` and runs under Playwright separately (SDS §7).
export default defineConfig({
  resolve: {
    alias: {
      // Resolve @app/shared to its source so `pnpm test` works without a prior
      // `pnpm build` (dist/ may not exist yet on a fresh clone).
      '@app/shared': fileURLToPath(new URL('./packages/shared/src/index.ts', import.meta.url)),
    },
  },
  test: {
    projects: [
      { extends: true, test: { name: 'shared', root: './packages/shared' } },
      { extends: true, test: { name: 'backend', root: './backend' } },
      { extends: true, test: { name: 'frontend', root: './frontend' } },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
    },
  },
});
