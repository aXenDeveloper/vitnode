/**
 * `tanstack-start-manifest:v` for the test run.
 *
 * The manifest lists the built client assets per route, which only exist after
 * a real build. Nothing under `/api/*` reaches it - a server route answers
 * before the SSR pass begins - so an empty one is enough to let the shell
 * render and act as the control the API assertions are measured against.
 */
export const tsrStartManifest = () => ({ routes: {} })
