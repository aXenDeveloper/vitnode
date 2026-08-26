import { createStartHandler } from '@tanstack/react-start/server'

/**
 * The app shell, stood in for.
 *
 * `createStartHandler` takes the SSR render callback, so anything that reaches
 * the app router lands here instead of rendering React. That makes the shell
 * identifiable in an assertion: a response carrying this body came from the
 * router, and a response that does not came from a server route.
 */
export const SHELL_BODY = '<!doctype html><html data-test-shell></html>'

/**
 * The real TanStack Start request handler, over the app's real route tree.
 *
 * This is the same function Nitro calls for every request in production - route
 * matching, the request middleware chain, server-route method dispatch and the
 * fall-through to SSR all run for real. Only the two things a test cannot have
 * are replaced: the built asset manifest and the React render.
 */
export const startHandler = createStartHandler(
  () =>
    new Response(SHELL_BODY, {
      headers: { 'content-type': 'text/html; charset=utf-8' },
      status: 200,
    }),
)
