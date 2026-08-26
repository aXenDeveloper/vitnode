/**
 * `#tanstack-start-entry` for the test run.
 *
 * The app has no `src/start.ts`, so it has no start instance either and Start
 * falls back to its own default request middleware. Mirroring that here keeps
 * the middleware chain the tests run identical to production's.
 */
export const startInstance = undefined
