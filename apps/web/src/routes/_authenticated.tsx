import { createFileRoute, redirect } from '@tanstack/react-router'

import { ensureAuthState } from '#/lib/auth/query'
import { LOGIN_PATH, returnToFor } from '#/lib/auth/redirects'
import { canAccessAuthenticatedRoute } from '#/lib/auth/shared'

/**
 * The boundary every page that requires a signed-in visitor sits under.
 *
 * Pathless - the leading underscore means it contributes no URL segment - so a
 * route joins it by *where its file lives*, not by remembering to call a guard:
 * `routes/_authenticated/settings.tsx` is `/settings`, guarded, and the guard is
 * this file. That is the whole point of introducing it now, with nothing under
 * it yet: Stage 8 moves `/settings/*` here and inherits the rule rather than
 * writing a second copy of it.
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
 * ## What it is not
 *
 * A navigation guard, and only that. Every private read is authorized by Hono
 * from the session cookie, in the API's own handlers - so a visitor who edits
 * this app's cached session in devtools gets a page shell and an API that still
 * refuses them. Nothing here is, or may become, the security boundary. See the
 * long note in `#/lib/auth/shared`.
 *
 * ## What children receive
 *
 * `beforeLoad`'s return merges into the context of everything below, so a child
 * route reads `context.auth` already narrowed to the signed-in half of the union
 * - `auth.user` is non-null without a check. It is the same object the guard
 * decided on, from the same cache entry, so a page cannot disagree with the
 * guard that let it render.
 */
export const Route = createFileRoute('/_authenticated')({
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
