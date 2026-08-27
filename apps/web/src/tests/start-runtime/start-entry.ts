/**
 * `#tanstack-start-entry` for the test run.
 *
 * The app's real `src/start.ts`, so the middleware chain the tests run is the
 * one production runs: the CSRF guard on server functions, then locale routing.
 * The Start Vite plugin generates this module in a real build; here it is
 * aliased in `vitest.config.ts` so `createStartHandler` can be driven without
 * the plugin.
 */
export { startInstance } from '#/start'
