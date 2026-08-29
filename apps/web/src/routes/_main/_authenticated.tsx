import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  canAccessAuthenticatedRoute,
  ensureAuthState,
  LOGIN_PATH,
  returnToFor,
} from '@vitnode/core/tanstack/auth'

/**
 * The boundary every page that requires a signed-in visitor sits under.
 *
 * Pathless - the leading underscore means it contributes no URL segment - so a
 * route joins it by *where its file lives*, not by remembering to call a guard:
 * `routes/_main/_authenticated/settings.tsx` is `/settings`, guarded, and the
 * guard is this file. That is what it buys, and Stage 9 is where it pays: the
 * settings layout and its four panels moved under here and inherited the rule
 * rather than writing a second copy of it, and neither the layout nor any panel
 * contains the word "session".
 *
 * Three pages sit under it today - `/files`, `/settings` and the settings
 * subtree - and none of them checks a session. That is the invariant
 * `src/tests/settings-routes.test.ts` pins by scanning for the absence.
 *
 * ## Why the check is in `beforeLoad`
 *
 * `beforeLoad` runs before the route's loader and long before React, so an
 * anonymous visitor never receives a byte of a protected page - not a flash, not
 * a hydration, not a `useEffect` that redirects afterwards. A component-level
 * check would render the page first and then take it away, which is both a
 * visible flicker and, on the server, protected markup already written into the
 * stream.
 *
 * ## A failed session read is not a signed-out visitor
 *
 * `ensureAuthState` rejects when the session could not be read - a rate limit, a
 * 500, an API that is not listening - and that rejection is deliberately left to
 * propagate. Only `canAccessAuthenticatedRoute` answering `false`, on a session
 * the API actually returned, sends anybody to the login page. Catching the
 * rejection and redirecting would sign a visitor out because of an outage, which
 * is precisely the bug this shape exists to prevent.
 *
 * ## What it is not
 *
 * A navigation guard, and only that. Every private read is authorized by Hono
 * from the session cookie, in the API's own handlers - so a visitor who edits
 * this app's cached session in devtools gets a page shell and an API that still
 * refuses them. Nothing here is, or may become, the security boundary. See the
 * long note on `authStateFromSession` in `@vitnode/core/tanstack/auth`.
 *
 * ## What children receive
 *
 * `beforeLoad`'s return merges into the context of everything below, so a child
 * route reads `context.auth` already narrowed to the signed-in half of the union
 * - `auth.user` is non-null without a check. It is the same object the guard
 * decided on, from the same cache entry, so a page cannot disagree with the
 * guard that let it render.
 */
export const Route = createFileRoute('/_main/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    const auth = await ensureAuthState(context.queryClient)

    if (!canAccessAuthenticatedRoute(auth)) {
      // TanStack Router's own control-flow signal: `redirect()` returns a
      // typed redirect object that the router catches and turns into a
      // navigation (or, during SSR, a 302). Throwing it is what stops the
      // guard - and what narrows the code below.
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw redirect({
        search: {
          // The *internal* path - the locale has already been stripped by the
          // rewrite - so the value that round-trips through the login URL
          // carries no language, and the prefix is written back exactly once,
          // by the rewrite, when the router builds the way home.
          returnTo: returnToFor(location),
        },
        to: LOGIN_PATH,
      })
    }

    return { auth }
  },
})
