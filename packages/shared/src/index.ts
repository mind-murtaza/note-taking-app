/**
 * @app/shared — single source of shared types, Zod schemas, and constants
 * imported by both `backend` and `frontend`. Domain schemas arrive in later
 * tickets (AB-1002+); AB-1001 ships only the package skeleton and the env
 * validation pattern.
 */
export const SHARED_PACKAGE = '@app/shared';

export * from './env.js';
