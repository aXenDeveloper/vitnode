import type { readSessionOnApi } from "./server";

/**
 * The signed-in visitor, or `{ user: null }` - the shape `GET /users/session`
 * answers with, and the one every other module here describes state in terms
 * of.
 *
 * Read off the server-side read rather than written out again. The shape is a
 * Zod schema in `api/modules/users/routes/session.route.ts` and reaches here
 * through the fetcher's inference, so a field added or renamed there arrives
 * without anybody editing this file. A hand-maintained copy is a second source
 * of truth that typechecks perfectly while disagreeing with the server.
 *
 * The import is type-only, which is what makes the indirection safe: TypeScript
 * erases it, so a browser bundle that reads {@link SessionApi} does not reach
 * `./server`, its `server-only` marker, or the request scope behind it.
 */
export type SessionApi = Awaited<ReturnType<typeof readSessionOnApi>>;
