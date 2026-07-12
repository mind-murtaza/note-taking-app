import { describe, it, expect } from 'vitest';
import { createApp } from './index.js';

describe('createApp', () => {
  it('builds an Express app', () => {
    const app = createApp();
    expect(typeof app.listen).toBe('function');
    expect(typeof app.use).toBe('function');
  });
});
