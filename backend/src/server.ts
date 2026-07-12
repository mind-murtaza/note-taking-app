import { parseEnv } from '@app/shared';
import { createApp } from './index.js';

// Composition root: validate env, build the app, listen. Run via `pnpm --filter
// @app/backend dev`.
const env = parseEnv(process.env);

createApp().listen(env.PORT, () => {
  console.log(`[backend] listening on :${env.PORT}`);
});
