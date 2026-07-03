import { z } from 'zod';

/**
 * Runtime validation for process environment. This is the reusable pattern
 * every later config (SDS §10.1, AGENTS.md §13) follows: define a Zod schema,
 * parse `process.env` once at startup, export the typed result. Feature tickets
 * extend `envSchema` with the vars they add.
 */
export const envSchema = z.object({
  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(1),
  ACCESS_TOKEN_TTL: z.string().min(1).default('15m'),
  REFRESH_TOKEN_TTL: z.string().min(1).default('7d'),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate an environment-like record. The caller supplies the source (the
 * backend calls `parseEnv(process.env)`), keeping this package free of any
 * Node- or browser-specific runtime dependency.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse(source);
}
