import "@tanstack/react-start/server-only";

import type { adminModule } from "@/api/modules/admin/admin.module";

import { clientModule } from "@/lib/fetcher-client";
import { fetcherServer } from "@/tanstack/fetcher/server";

import {
  adminSessionFailureFromError,
  adminSessionFailureFromStatus,
} from "./state";

/**
 * The AdminCP session read against the Hono admin API - the half that can only
 * run on a server.
 *
 *     createServerFn -> here -> fetcherServer -> Hono admin API
 *
 * `@vitnode/core/tanstack/admin/server`, and the only subpath of this feature
 * allowed to be one: it imports the request scope through `fetcherServer` and
 * the `server-only` marker above, and the barrel beside it is imported by
 * browser bundles.
 *
 * The `createServerFn` itself stays in the host (`apps/web/src/lib/admin-auth.ts`)
 * and this module is the reason that costs nothing. A server function declared
 * *here* would answer the browser correctly over `/_serverFn/*` and silently
 * resolve to `undefined` during SSR, because the host externalises this package
 * from Vite's SSR pass and nothing in that path runs the Start compiler.
 * `tanstack/boundary.test.ts` forbids the primitive outright. So the host
 * declares one one-line wrapper, registers it through `./transport`, and every
 * decision below is made once, here.
 *
 * The API is unchanged and unrelaxed. `api/config.ts` puts
 * `globalAdminMiddleware()` in front of every request whose path contains
 * `/admin/`, and the session route itself throws `403` when `c.get("admin")`
 * holds no user. Everything here is transport: forward the request state, and
 * turn a status into one of the finite reads in `./state`.
 */

/**
 * The admin module by type only, so nothing the API needs at runtime - Hono,
 * Drizzle, the plugin tree - is pulled in by a value import. `clientModule`
 * keeps the route paths, methods and response schemas fully typed while carrying
 * just the `pluginId` the fetcher reads.
 */
const admin = clientModule<typeof adminModule>("@vitnode/core");

/**
 * The signed-in administrator and their effective permission set - the TanStack
 * Start counterpart of `@vitnode/core`'s `getSessionAdminApi()`.
 *
 * ## It never invents a denial
 *
 * `{ status: "denied" }` means one thing only: the API answered `403`, so this
 * browser holds no admin session. A read that could not be *evaluated* - a `429`
 * from the rate limiter, a `500`, an API that is not listening - resolves to a
 * failure member instead, and the query in `./session-query` turns that into a
 * rejection.
 *
 * That is the whole reason this function exists in the shape it does. The
 * Next.js helper it replaces maps every non-`200` onto `redirect("/admin")`,
 * which during an outage takes a working administrator, decides they are not
 * one, and puts a sign-in form in front of them for a session they already hold.
 * `readSessionOnApi` was rewritten to remove exactly that bug on the public
 * session; this is the same rule for the admin one.
 *
 * ## Why a failure is a value here and a rejection later
 *
 * This function's result crosses a server-function boundary, and only plain data
 * survives that: a thrown `Error` arrives as a serialized message with its class
 * gone, so `{ status: "network_error" }` would be indistinguishable from
 * `{ status: "api_error" }` by the time anything could branch on it. Returning
 * the discriminated value keeps the distinction, and `./session-query` builds
 * the rejection from it on whichever side is reading.
 *
 * ## The cookie is the authorization, and it is not sent from here
 *
 * Nothing about who is asking is passed as an argument - no user id, no
 * permission list, no session token. `fetcherServer` forwards the request's own
 * `Cookie` header, the API reads `vitnode_auth_admin` off it, and
 * `SessionAdminModel.getUser()` re-runs `checkIfUserIsAdmin` against the
 * database even on a cache hit. Handing this function an identity would make it
 * a second, weaker answer to a question the cookie already settles.
 *
 * Deliberately not cached, for the same reason `getSessionAdminApi()` is not:
 * removing an administrator has to take effect promptly, and a stored copy keyed
 * by their cookie would undo that. The database work behind it is cached in
 * Redis by the API instead, for 60 seconds, with explicit invalidation on every
 * mutation that changes the answer. That is where the caching lives and it stays
 * there - see the note on `staleTime` in `./session-query`.
 */
export const readAdminSessionOnApi = async () => {
  try {
    const response = await fetcherServer(admin, {
      method: "get",
      module: "admin",
      path: "/session",
    });

    // Narrowed on `200` rather than mapped from the status, so the session body
    // is in scope when the granted member is built and this function's return
    // type carries the fetcher's inferred shape. `./session-api` reads
    // `AdminSessionApi` straight back off it, which is what keeps the API's Zod
    // schema the only place the shape is written down.
    if (response.status === 200) {
      return { session: await response.json(), status: "granted" as const };
    }

    return adminSessionFailureFromStatus(response.status);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[admin] the admin session could not be read", error);

    // The error itself is deliberately not carried out of this function. It is
    // `rawApiFetch`'s - the failing API URL and the server's own error text -
    // and this value is serialized back to a browser. It has just been written
    // to the server log, which is where it belongs.
    return adminSessionFailureFromError(error);
  }
};

/**
 * The command palette's user lookup, re-exported so it has a public subpath.
 *
 * `./tanstack/*\/server` resolves to this module and to nothing else, so a
 * feature's second server-side reader reaches a host through here or not at all.
 * It is a re-export rather than an implementation because the two reads answer
 * to different contracts and must not share a mapper: the session read above
 * treats a non-decision as a failure and rejects, while a palette that cannot
 * reach the user index degrades to `[]` and still shows the pages it matched.
 * Folding them together would make one of those two wrong.
 */
export { readAdminUserSearchOnApi } from "./search-server";
