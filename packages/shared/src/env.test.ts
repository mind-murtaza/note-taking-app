import { describe, it, expect } from 'vitest';
import { parseEnv } from './env.js';

describe('parseEnv', () => {
  it('parses a valid environment and applies defaults', () => {
    const env = parseEnv({
      DATABASE_URL: 'postgresql://app:app@localhost:5432/notes_dev',
      JWT_SECRET: 'secret',
    });
    expect(env.PORT).toBe(3000);
    expect(env.ACCESS_TOKEN_TTL).toBe('15m');
    expect(env.REFRESH_TOKEN_TTL).toBe('7d');
  });

  it('throws when a required variable is missing', () => {
    expect(() => parseEnv({})).toThrow();
  });
});
