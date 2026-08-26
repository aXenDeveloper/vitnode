/**
 * `#tanstack-router-entry` for the test run.
 *
 * The Start Vite plugin generates this module in a real build; here it is
 * aliased in `vitest.config.ts` so `createStartHandler` can be driven without
 * the plugin. It hands back the app's own router - the real
 * `routeTree.gen.ts`, so the real `/api/$` route object - which is the whole
 * point: the tests exercise the routes the app actually serves.
 */
export { getRouter } from '#/router'
