import { useQuery } from '@tanstack/react-query'
import { UserHeaderContent } from '@vitnode/core/views/layouts/theme/header/user/user-header-content'
import { userHeaderState } from '@vitnode/core/views/layouts/theme/header/user/user-header-model'
import { toast } from 'sonner'
import { useTranslations } from 'use-intl'

import { MigrationLink } from '#/components/migration-link'
import { useSignOutAction } from '#/lib/auth/actions'
import { sessionQueryOptions } from '#/lib/auth/query'

/**
 * The user area of the main header, wired to this app.
 *
 * Everything visible is `UserHeaderContent`'s - the avatar, the menu, the guest
 * buttons and the placeholder are the same components the Next.js header renders.
 * What is here is the three things that component refuses to decide:
 *
 *     the session  ->  sessionQueryOptions()   the one canonical entry
 *     a link       ->  MigrationLink           the route tree decides per href
 *     sign-out     ->  useSignOutAction()      Stage 6's action, unchanged
 *
 * ## One session, read - not fetched
 *
 * `useQuery` over `sessionQueryOptions()`, which is the *same definition* that
 * `_authenticated`'s guard calls through `ensureAuthState`. One key, one cache
 * entry, one request: the header cannot show a visitor the guard has already
 * turned away, and signing in or out replaces the value both of them read. There
 * is no `AuthContext`, no module-level session and no second call to
 * `/users/session` - see the long note in `#/lib/auth/query` for why the
 * QueryClient's per-request lifetime is what a session needs.
 *
 * `useQuery` rather than `useSuspenseQuery` on purpose. The header is on every
 * page, and suspending it would suspend the shell: with the entry warm both read
 * from the cache with no round trip, but when it is *not* warm - a client-side
 * arrival at a route whose loader did not ask for it - `useQuery` renders the
 * placeholder while `useSuspenseQuery` would hold back the whole page for a
 * session only the header needs.
 *
 * ## What the shell owes it: one line
 *
 * `_main`'s loader calls `prefetchSession(context.queryClient)`. With
 * it, the entry is filled before anything renders, the SSR pass dehydrates it,
 * and the very first paint shows the visitor - no placeholder, no shift, and no
 * round trip after hydration. Without it this still works, and works correctly:
 * the server renders the placeholder and the browser fills it in a moment later.
 * So it is a performance requirement rather than a correctness one, which is why
 * this component does not try to enforce it.
 *
 * It is deliberately `prefetchSession` and not `ensureAuthState`. The latter
 * *rejects* when the session cannot be read - correct for a guard, because an
 * outage must not sign anybody out - and in a shell's loader that same rejection
 * would replace every page on the site with an error screen because the header
 * could not name the visitor. Both go through `sessionQueryOptions()`, so it is
 * still one cache entry either way.
 *
 * ## The three states are `userHeaderState`'s to name
 *
 * Including the one that matters here: a session already in hand wins over an
 * error, so a failed *refetch* does not flicker a signed-in visitor to anonymous
 * and back. A read that has failed with nothing cached shows the guest controls,
 * which is what the Next.js header has always done - and which is emphatically
 * not what a route guard does with the same failure.
 */
export const UserHeader = () => {
  const { data, isError } = useQuery(sessionQueryOptions())
  const signOut = useSignOutAction()
  const tErrors = useTranslations('core.global.errors')

  /**
   * Sign-out, and the one thing Stage 6's action leaves to its caller.
   *
   * The action already does all of it - `DELETE /sign_out`, the cookie cleared
   * by the API's own `Set-Cookie`, the anonymous session written into the
   * canonical entry, that entry invalidated, and `router.invalidate()` so a
   * visitor sitting behind `_authenticated` is redirected out by the guard that
   * owns that rule. Nothing is repeated here: no second `invalidate`, no
   * `setQueryData` of anything else, no navigation of our own.
   *
   * What is left is the failure, which the action reports rather than throws. A
   * session that could not be ended is a server problem the visitor cannot act
   * on, so it is the internal-error toast - the same one the sign-in form raises
   * for the same class of answer - and the header stays as it was, which is
   * honest: they are still signed in.
   */
  const onSignOut = async () => {
    const result = await signOut()

    if (result.ok) return

    toast.error(tErrors('title'), {
      description: tErrors('internal_server_error'),
    })
  }

  return (
    <UserHeaderContent
      LinkComponent={MigrationLink}
      onSignOut={onSignOut}
      state={userHeaderState({ isError, session: data })}
    />
  )
}
