import { test, expect } from '@playwright/test';

// Placeholder E2E — no browser fixture yet, so it runs without `playwright
// install`. The real user journey lands in AB-1016.
test('scaffold smoke test', () => {
  expect(1 + 1).toBe(2);
});
