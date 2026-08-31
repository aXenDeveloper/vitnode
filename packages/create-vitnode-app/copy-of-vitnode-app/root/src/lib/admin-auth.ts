import { createServerFn } from "@tanstack/react-start";
import { setAdminTransport } from "@vitnode/core/tanstack/admin";
import { readAdminSessionOnApi } from "@vitnode/core/tanstack/admin/server";

/**
 * This application's admin transport: one server function, and nothing else.
 *
 *     browser -> server function -> @vitnode/core/tanstack/admin/server
 *                                            |
 *                                       fetcherServer -> Hono admin API
 *
 * The handler is one line, and that is the point of the file. What the read
 * *means* - which status is a denial, which is a failure, what a failure is
 * allowed to become - lives in `@vitnode/core/tanstack/admin`, so it is stated
 * once for every VitNode install rather than once per application. This is the
 * same arrangement `lib/auth.ts` makes for the eight auth calls, for the same
 * reason.
 *
 * ## Why the declaration cannot move into the package
 *
 * `createServerFn` needs the module it sits in to be transformed by the Start
 * compiler on *both* sides of the render, and package code only gets that on
 * one. `vite.config.ts` externalises `@vitnode/core` from Vite's SSR pass -
 * Nitro's own Rollup run inlines the built `dist` afterwards - so the package
 * reaches the server un-compiled, where `.handler(fn)` receives one argument
 * instead of two and the call resolves to `undefined` with no error at all. It
 * would answer the browser correctly over `/_serverFn/*` and silently return
 * nothing during SSR, which is the worst of the available failures.
 * `packages/vitnode/src/tanstack/boundary.test.ts` forbids the primitive there
 * outright, and `src/tests/package-boundary.test.ts` checks the shipped `dist`
 * for it.
 *
 * The client half costs nothing: Start's compiler replaces the handler body with
 * an RPC stub, and the `@vitnode/core/tanstack/admin/server` import - and the
 * `server-only` marker inside it - goes with it.
 *
 * ## Why this is a server function and not an isomorphic fetch
 *
 * The public feed reads use `createIsomorphicFn`, because they are the same
 * request from either side. This one is not: it has to forward the request's
 * `Cookie` header to Hono, and only a server request scope has one. Run in the
 * browser it would carry no admin cookie and answer `403` for every
 * administrator.
 *
 * ## Why it takes no arguments, and no validator
 *
 * There is no input to validate. Who is asking is the `vitnode_auth_admin`
 * cookie the request arrives with, which the browser cannot forge and cannot
 * choose. Accepting a user id here - even only as a cache key, even only as a
 * hint - would be a second, weaker answer to a question the cookie already
 * settles, and one a caller controls.
 *
 * It is also not a `POST`, and therefore not behind `createCsrfMiddleware`,
 * because it changes nothing: it reads a cookie and answers who it belongs to.
 * The seven auth *mutations* are POSTs for exactly the opposite reason.
 */
export const readAdminSessionFn = createServerFn().handler(
  async () => await readAdminSessionOnApi(),
);

/**
 * Hand it to `@vitnode/core/tanstack/admin`, once, at module scope.
 *
 * `src/router.tsx` imports this module for the side effect, so the registration
 * happens in both bundles before any route can run - a router is the one thing
 * every entry point loads. It is a registry of a *function reference*, identical
 * for every visitor and every request, so a module-level value is safe on a
 * server rendering many administrators at once; there is no session, no user and
 * no permission set here. Those live in the per-request `QueryClient`.
 */
setAdminTransport({
  readAdminSession: async () => await readAdminSessionFn(),
});
