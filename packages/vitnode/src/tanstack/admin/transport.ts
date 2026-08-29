import type { AdminSessionReadResult } from "./session-api";

/**
 * How this package reaches the admin session endpoint, handed to it by the
 * application.
 *
 * One call, and it is `createServerFn` in the host. That is not a preference, it
 * is the one thing a package cannot own: the host externalises `@vitnode/core`
 * from Vite's SSR pass, so this code reaches the server *uncompiled* - and an
 * uncompiled `createServerFn` hands its `.handler()` one argument where the
 * compiler passes two, which makes an SSR-side call resolve to `undefined` with
 * no error at all. It would work in the browser, over `/_serverFn/*`, and
 * silently answer nothing during a render. `tanstack/boundary.test.ts` forbids
 * the primitive here outright.
 *
 *     apps/web                  @vitnode/core/tanstack/admin
 *     ----------------------------------------------------------------
 *     createServerFn            ./server         call Hono, map the status
 *       .handler(fn)            ./state          what each status means
 *                               ./session-query  the one cache entry
 *
 * ## Why a server function rather than an isomorphic fetch
 *
 * The read needs the request's `Cookie` header forwarded to Hono, and only a
 * server request scope has one. `createIsomorphicFn` - the pattern the public
 * feed reads use - would run its client branch in the browser, where a
 * cross-origin call to the API would carry no admin cookie at all. So this
 * follows `lib/auth.ts`'s session read exactly: a server function on both sides
 * of the render, directly during SSR and over same-origin RPC afterwards.
 *
 * ## This is a transport, not a permission store
 *
 * Nothing here holds a session, an administrator or a permission set. The
 * canonical admin session lives in exactly one place - the `["vitnode",
 * "admin-session"]` entry in the host's `QueryClient` - and `./session-query` is
 * the only definition of it. This registry holds a function reference, which is
 * the same for every visitor and every request, which is why a module-level
 * value is safe on a server that renders many visitors at once.
 */
export interface AdminTransport {
  /**
   * The administrator this browser's admin cookie names, the denial the API
   * issued, or the failure that stopped it answering either.
   *
   * Takes no arguments, and must not grow any. Who is asking is the
   * `vitnode_auth_admin` cookie the request carries; a user id passed in here
   * would be a second, weaker answer to a question the cookie already settles,
   * and one the browser cannot be trusted to give.
   *
   * Never rejects for a failed read - it resolves to an `api_error` or
   * `network_error` member instead, because a thrown error does not survive the
   * server-function boundary with its kind intact. `./session-query` turns those
   * into the rejection a route guard sees.
   */
  readAdminSession: () => Promise<AdminSessionReadResult>;
}

let registered: AdminTransport | undefined;

/**
 * The message a caller gets when the application forgot to register.
 *
 * A named constant so the host's own test can assert on it without matching
 * English, and so the sentence says what to do rather than what went wrong.
 */
export const ADMIN_TRANSPORT_MISSING =
  "No admin transport is registered. Call setAdminTransport() from a module the application always loads - the router entry - before any admin route runs.";

/**
 * Register the application's server function, once, at module scope.
 *
 * Called from a module both bundles load (`apps/web/src/router.tsx` imports the
 * host's `lib/admin-auth.ts` for exactly this), so the registry is filled before
 * any route, loader or component can reach for it. Registering twice replaces
 * the previous value rather than throwing: a hot reload re-evaluates the module,
 * and a build error is a worse answer than the newer function.
 *
 * Module scope means *per bundle*. The browser has one instance and the server
 * has one instance, and each registers its own - which is the same lifetime the
 * server function itself has. Note what is *not* stored here: no session, no
 * administrator, no permissions. Those live in the per-request `QueryClient`,
 * which is what stops one administrator's answer being rendered into another's
 * page during a concurrent SSR.
 */
export const setAdminTransport = (transport: AdminTransport): void => {
  registered = transport;
};

/**
 * The registered transport, or a failure that says what is missing.
 *
 * Read at call time rather than captured at module scope, so a module that
 * merely *imports* the query definition does not have to be loaded after the
 * registration - only the call has to happen after it, which is trivially true
 * for anything a route can reach.
 */
export const adminTransport = (): AdminTransport => {
  if (!registered) throw new Error(ADMIN_TRANSPORT_MISSING);

  return registered;
};

/** Whether an application has registered a transport yet. For tests. */
export const hasAdminTransport = (): boolean => registered !== undefined;
