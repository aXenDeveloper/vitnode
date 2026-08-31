import type {
  AuthNavigate,
  InternalDestination,
} from '@vitnode/core/tanstack/auth'

import { useRouter } from '@tanstack/react-router'
import { parseInternalDestination } from '@vitnode/core/tanstack/auth'

import { localeRouting } from '#/lib/i18n/shared'

/**
 * Going somewhere in this application from code.
 *
 * The counterpart to a rendered link: a navigation nobody clicked - the one a
 * sign-in performs when it is finished, the one the login and `/admin` guards
 * perform for somebody who is already signed in, and the one the AdminCP's
 * command palette performs on Enter. Every one of them is handed a path that a
 * visitor supplied (`?returnTo=`), so the two questions a target has to answer
 * are kept apart:
 *
 *     safe   - may this app send a browser here at all?   `sanitizeReturnTo`
 *     shape  - what does the router want to be handed?    here
 *
 * The first is `@vitnode/core/tanstack/auth`'s and is applied where the value is
 * *used*; nothing here relaxes it. This module only answers the second.
 *
 * There is no third question. Every URL this application shows is a route in its
 * own tree, so "which application serves this path" is not asked, and there is
 * no list of routes anywhere for it to be asked against.
 */

/**
 * A base for parsing an href that carries no origin. Never requested, and never
 * rendered - only `pathname`, `search` and `hash` are ever read back off it.
 */
const RELATIVE_BASE = 'https://vitnode.invalid'

/**
 * An href in the spelling the route tree uses: the locale prefix removed,
 * the query and hash intact.
 *
 * The route tree has no locale in it, so what the router is handed must not
 * either - and then `rewrite.output` writes the prefix back when the location is
 * built. Stripping it here and re-adding it there is one rule running in two
 * directions, not two rules.
 *
 * That matters because the href is user-supplied. `returnTo` is produced from an
 * internal path in the normal flow - `returnToFor` builds it from the location
 * the route tree already matched - but nothing stops somebody visiting
 * `/pl/login?returnTo=/pl/discover`, and `sanitizeReturnTo` accepts it, because
 * it is a perfectly safe application path. Passing `/pl/discover` through as
 * `to` would ask the router to navigate to a route that does not exist under
 * that name.
 *
 * `deLocalizeUrl` is the app's own locale rule - the same one `rewrite.input`
 * applies - rather than a prefix check written here, which would be a second
 * copy that disagreed the first time a language was added. It already knows
 * which paths carry no locale at all (`/admin`, `/api`), so `/admin/core` comes
 * back untouched and `/plugins` is not mistaken for Polish.
 */
const internalHref = (href: string): string => {
  const { hash, pathname, search } = localeRouting.deLocalizeUrl(
    new URL(href, RELATIVE_BASE),
  )

  return `${pathname}${search}${hash}`
}

/**
 * A validated internal path, split into the fields a router navigation takes.
 *
 * **Not `href`.** A redirect carrying `href` is used verbatim by
 * `Router.resolveRedirect` - it short-circuits before `buildLocation` - so it
 * would skip the locale rewrite and drop a Polish visitor on the English page.
 * Split into `to`/`search`/`hash`, the same navigation goes through
 * `buildLocation`, the rewrite writes the prefix back, and no code here has to
 * know a language exists.
 *
 * Pure, and deliberately so: the same decision is made in two environments that
 * share no navigation API. A `beforeLoad` running on the server turns the result
 * into an HTTP redirect through `redirect()`, and a click handler in the browser
 * turns it into a `router.navigate()` call. Both take this exact shape, so only
 * the execution differs.
 */
export const internalDestination = (href: string): InternalDestination =>
  parseInternalDestination(internalHref(href))

/**
 * Navigate to a validated internal path.
 *
 * The browser half. `router.navigate` performs it, so the router's own blockers
 * and dangerous-protocol checks run and nothing here reaches around the
 * framework with `location.assign`.
 */
export const useAppNavigate = (): AuthNavigate => {
  const router = useRouter()

  return async (href: string): Promise<void> => {
    await router.navigate(internalDestination(href))
  }
}
