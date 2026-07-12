import { defineConfig } from 'vitest/config';

// Unit + integration tests run under Vitest across the three code packages.
// E2E lives in `e2e/` and runs under Playwright separately (SDS §7).
export default defineConfig({
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
