/**
 * The seam between the web runtime and the Hono API.
 *
 * A bridge is handed the `Request` the browser (or an SSR loader) made to
 * `/api/*` on this origin and answers it with whatever Hono answers. It is one
 * line, and that is the point: status, body, every `Set-Cookie`, the cookie and
 * `x-forwarded-*` headers the API reads are all already correct on the request
 * the platform built, and stay correct exactly as long as nobody rebuilds them.
 *
 * `src/tests/api-bridge-contract.ts` holds this to that behaviour, including the
 * ways a rebuilt request loses it.
 */
export type ApiBridge = (request: Request) => Promise<Response> | Response

interface FetchableApp {
  fetch: (request: Request) => Promise<Response> | Response
}

export const createApiBridge =
  (app: FetchableApp): ApiBridge =>
  async (request) =>
    app.fetch(request)
