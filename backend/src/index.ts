import express, { type Express } from 'express';
import { SHARED_PACKAGE } from '@app/shared';

/**
 * Placeholder app factory. Real routers/middleware (route → service →
 * repository) arrive in AB-1002+. Kept side-effect-free so tests can import it
 * without starting a server; `server.ts` owns the `listen`.
 */
export function createApp(): Express {
  const app = express();

  app.get('/health', (_req, res) => {
    res.json({ data: { status: 'ok', shared: SHARED_PACKAGE } });
  });

  return app;
}
