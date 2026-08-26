import { createFileRoute } from '@tanstack/react-router'

import { apiBridge } from '#/server/vitnode-api.server'

/**
 * `/api/*` - the existing VitNode Hono application, mounted.
 *
 * `server` is the only option on this route on purpose. TanStack Start prunes a
 * route file whose sole option is `server` out of the client route tree
 * entirely (and its client code-splitter deletes the `server` node on top of
 * that), so none of the API - Hono, Drizzle, the plugins - can reach the browser
 * bundle. The `.server.ts` import is refused by import protection if that ever
 * stops being true.
 *
 * `ANY` rather than a handler per method: routing, OpenAPI, middleware, auth,
 * plugin mounting and error handling all stay inside Hono, exactly as they are
 * when the same app runs standalone in `apps/api` or under the Next.js catch-all
 * in `apps/docs`.
 */
export const Route = createFileRoute('/api/$')({
  server: {
    handlers: ({ createHandlers }) =>
      createHandlers({ ANY: async ({ request }) => apiBridge(request) }),
  },
})
