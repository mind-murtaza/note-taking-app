import { defineConfig } from '@playwright/test';

// Placeholder Playwright config. The full journey (register → login → create →
// tag → search → share → restore → logout) lands in AB-1016.
export default defineConfig({
  testDir: './tests',
});
