import { createFileRoute } from '@tanstack/react-router'
import {
  loadSsoCallbackRoute,
  normalizeSsoCallbackSearch,
  SsoCallbackRouteContent,
} from '@vitnode/core/tanstack/auth'

import { ErrorActions } from '#/migration/error-actions'
import { MigrationLink } from '#/migration/link'

/**
 * Where an SSO provider sends the visitor back to.
 *
 * `/login/sso/google` and `/pl/login/sso/google` are one route, and the URL
 * shape is not this app's to choose: the API registers it with every provider as
 * `${NEXT_PUBLIC_WEB_URL}login/sso/<id>` (`api/models/sso.ts`), so whichever app
 * that origin serves has to answer it.
 *
 * ## Why it is a sibling of `/login` and not a child
 *
 * The file is `login_.sso.$providerId.tsx` - the trailing underscore opts out of
 * nesting - and that spelling is load bearing twice over.
 *
 * 1. **The guest guard must not run here.** By the time a provider redirects
 *    back, the API has already minted its `--state-sso` cookie and the visitor
 *    may well have been signed in by a parallel tab. Sitting under `/login`'s
 *    guard, a signed-in visitor arriving with a valid `code` would be bounced
 *    away before the exchange ran, abandoning a half-finished OAuth round trip.
 * 2. **`/login` must stay an exact match.** A `/login` route with children
 *    matches every path beneath it, so `isTanStackOwnedPath` would answer
 *    "owned" for URLs no route declares. Three leaves, no shared parent.
 *
 * The exchange, the callback parsing and every screen it can end on are
 * `@vitnode/core/tanstack/auth`.
 */

export const Route = createFileRoute('/login_/sso/$providerId')({
  /**
   * What a provider may put in the callback URL - the package's contract, not
   * this application's.
   *
   * Which half arrives is the provider's decision, so nothing is required, and
   * nothing is coerced: an all-digit `state` reaches `validateSearch` as a
   * number, and the `z.string()` this replaced threw on it, rendering an error
   * boundary in the middle of a sign-in the visitor had already approved. The
   * values are judged by `parseSsoCallback`, which bounds their length,
   * classifies the error rather than carrying it through, and is where the whole
   * rule lives.
   */
  validateSearch: normalizeSsoCallbackSearch,
  loader: async ({ context }) => await loadSsoCallbackRoute(context),
  component: SsoCallbackRoute,
})

function SsoCallbackRoute() {
  return (
    <SsoCallbackRouteContent
      errorActions={<ErrorActions />}
      LinkComponent={MigrationLink}
      providerId={Route.useParams().providerId}
      search={Route.useSearch()}
    />
  )
}
