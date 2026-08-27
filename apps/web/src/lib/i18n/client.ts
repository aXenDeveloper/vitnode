import type { QueryClient } from '@tanstack/react-query'
import type { AnyRouter, LocationRewrite } from '@tanstack/react-router'

import { useRouter, useRouterState } from '@tanstack/react-router'
import { createIsomorphicFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import {
  readLocaleCookie,
  serializeLocaleCookie,
} from '@vitnode/core/lib/i18n/locale-cookie'

import type { Locale } from './shared'

import { intlQueryOptions, loadedIntlNamespaces } from './query'
import { localeRouting } from './shared'

/**
 * A base for parsing a router href that carries no origin. Never requested, and
 * never rendered - only `pathname`, `search` and `hash` are ever read back off
 * it.
 */
const RELATIVE_BASE = 'https://vitnode.invalid'

/**
 * The remembered language, wherever this happens to be running.
 *
 * Only routes outside the localized URL space ever ask - `/admin`, and anything
 * else in `DEFAULT_IGNORED_LOCALE_PATHS`. A public URL says which language it is
 * in, and this must never get a vote there.
 *
 * `createIsomorphicFn` is what keeps that one question from becoming two
 * functions that drift: the Start compiler keeps only the branch for the bundle
 * it is building, so the browser never sees `getRequestHeader` and the server
 * never touches `document`. Un-compiled - in tests, under plain Node - the stub
 * falls back to the server branch, which is the right default for a test run.
 */
const readCookieLocale = createIsomorphicFn()
  .server(() => {
    try {
      return readLocaleCookie(getRequestHeader('cookie'))
    } catch {
      // `getRequestHeader` throws outside a request scope, which is where a
      // prerender pass and a test both build links from. No request means no
      // stored preference, which is exactly what the default locale is for.
      return undefined
    }
  })
  // The locale cookie is deliberately not `HttpOnly`, so this read works: the
  // switcher writes it in the browser and the server reads the same one back.
  .client(() => readLocaleCookie(globalThis.document?.cookie))

/**
 * The language a URL is served in - the one authoritative answer.
 *
 * Everything that needs a locale comes through here: the router rewrite that
 * writes prefixes into links, `<html lang>`, the message query, the switcher.
 * There is deliberately no second source to disagree with it.
 *
 * `publicPathname` is the URL in the address bar, *before* the router rewrote
 * the prefix away. Handing it the internal path would resolve every request to
 * the default locale.
 *
 * The cookie is the only source handed to the shared helper, and that is the
 * whole contract for a route with no locale in its URL: **cookie, then the
 * default.** The helper can also negotiate an `Accept-Language` header and
 * deliberately is not asked to - the browser cannot read request headers, so a
 * server that answered `pl` from one would hydrate to `en` on the client: a
 * flash of the wrong language and a React hydration mismatch on every first
 * visit. First-visit negotiation is a product decision that needs its own
 * hydration-safe design, not a source quietly added here.
 *
 * The cast is safe by construction: the answer is either a code this app was
 * configured with or the default, never anything from the URL.
 */
export const resolveLocale = (publicPathname: string): Locale =>
  localeRouting.resolveLocale(publicPathname, {
    // A getter, so a public path - which is every request this app serves
    // today - never reads a cookie at all.
    get cookieLocale() {
      return readCookieLocale()
    },
  }) as Locale

/**
 * The path shown in the address bar, from a location the router parsed.
 *
 * Takes the one field it reads rather than a `ParsedLocation`, so it is equally
 * callable with `router.latestLocation`, with router state, and with a
 * `beforeLoad`'s `location` - three types that differ only in their search
 * schema.
 */
export const publicPathnameOf = ({
  publicHref,
}: {
  publicHref: string
}): string => new URL(publicHref, RELATIVE_BASE).pathname

/**
 * The router's half of locale routing: one route tree, two public URL shapes.
 *
 *     browser  /pl/discover  --input-->  /discover      route tree
 *     <Link to="/discover">  --output->  /pl/discover   rendered href
 *
 * `input` is why no route file ever mentions a locale. It is also why an unknown
 * first segment still 404s: only a prefix this app actually writes gets
 * stripped, so `/xx/discover` reaches the route tree intact and matches nothing.
 *
 * `output` reads the locale from the router's own current location rather than
 * from `window` or a module variable. That is the same value on the server (a
 * memory history seeded with the request) as in the browser (the address bar),
 * which is what keeps the `href` React renders during SSR identical to the one
 * it renders after hydration.
 */
export const createLocaleRewrite = (
  getRouter: () => AnyRouter | undefined,
): LocationRewrite => ({
  input: ({ url }) => localeRouting.deLocalizeUrl(url),
  output: ({ url }) => {
    const location = getRouter()?.latestLocation
    // Before the router has parsed a location there is nothing to read a locale
    // from - and no link has been built yet either.
    if (!location) return url

    return localeRouting.localizeUrl(
      url,
      resolveLocale(publicPathnameOf(location)),
    )
  },
})

/**
 * The language the page is currently in, as reactive state.
 *
 * Subscribed to the router's location rather than read off `window`, so a
 * language switch re-renders everything downstream of it - the provider, the
 * message query, `<html lang>` - with no reload and no second source of truth.
 */
export const useLocale = (): Locale =>
  useRouterState({
    select: (state) => resolveLocale(publicPathnameOf(state.location)),
  })

/**
 * Puts a language's messages in the cache before anything renders in it.
 *
 * Every set the page is currently showing, not just the global one. The root
 * provides `core.global`; a route provides whatever it renders on top of that
 * (`RouteMessages`), and both read through `useSuspenseQuery`. Warming only the
 * first would leave the second suspending on a key nobody had fetched - which,
 * because the suspend is caused by a store update, cannot be deferred: the page
 * blanks for a round trip. `loadedIntlNamespaces` answers "which sets" by
 * reading the cache, so this stays right as more routes declare their own.
 *
 * Failure is deliberately not fatal: the switch still happens, and each
 * provider's own query retries it. A language that cannot be fetched should
 * degrade to a moment of loading, not to a switcher that appears to do nothing.
 */
const warmMessages = async (router: AnyRouter, locale: Locale) => {
  const { queryClient } = router.options.context as {
    queryClient?: QueryClient
  }
  if (!queryClient) return

  const current = resolveLocale(publicPathnameOf(router.latestLocation))

  await Promise.all(
    loadedIntlNamespaces(queryClient, current).map(async (namespaces) => {
      try {
        await queryClient.ensureQueryData(
          intlQueryOptions({ locale, namespaces }),
        )
      } catch {
        /* empty */
      }
    }),
  )
}

/**
 * Switches the page's language, keeping the visitor exactly where they are.
 *
 *     /discover             -> pl -> /pl/discover
 *     /pl/discover?q=hello  -> en -> /discover?q=hello
 *     /admin/users          -> pl -> /admin/users  (only the language changes)
 *
 * Why `history.push` rather than `navigate()`: the locale lives *only* in the
 * public URL. Internally `/discover` and `/pl/discover` are the same location,
 * and `commitLocation` compares internal hrefs to decide whether anything moved
 * - so a `navigate()` to the same route is a no-op and the address bar never
 * changes. Pushing the public href is what the router itself does at the end of
 * every navigation (`this.history.push(nextHistory.publicHref)`), so this is the
 * same client-side transition, not a document reload.
 *
 * `invalidate()` then re-runs the matched routes. Two reasons: the internal URL
 * did not change, so nothing looks stale to the router even though every loader
 * that read `context.locale` now holds the previous answer - and on an ignored
 * route such as `/admin`, where the URL does not change at all, it is the whole
 * of the switch.
 *
 * Written as a plain function over a router rather than only as a hook, so the
 * behaviour above is testable without mounting React.
 */
export const switchLocaleOn = async (
  router: AnyRouter,
  locale: Locale,
): Promise<void> => {
  if (!localeRouting.isSupportedLocale(locale)) return

  // Fetched before the URL moves, not after. The location store updates the
  // moment history does, so the provider re-renders under the new locale - and
  // therefore the new query key - while the root loader is still resolving it.
  // That is a suspend, and a suspend caused by a store update cannot be
  // deferred: the page would blank for a round trip. Warmed first, the switch
  // is a re-render with the messages already in hand.
  await warmMessages(router, locale)

  const current = new URL(router.latestLocation.publicHref, RELATIVE_BASE)
  const next = localeRouting.localizeUrl(current, locale)

  if (next.href !== current.href) {
    router.history.push(`${next.pathname}${next.search}${next.hash}`)
  }

  await router.invalidate()
}

/** {@link switchLocaleOn}, bound to the mounted router, plus the cookie write. */
export const useSwitchLocale = () => {
  const router = useRouter()

  return (locale: Locale) => {
    // Remembered for the routes whose URL carries no locale - `/admin` - and for
    // the next visit. `Secure` only over HTTPS: set on plain `http://localhost`
    // the browser drops it without a word, and the choice never sticks.
    if (localeRouting.isSupportedLocale(locale)) {
      globalThis.document.cookie = serializeLocaleCookie(locale, {
        secure: globalThis.location.protocol === 'https:',
      })
    }

    void switchLocaleOn(router, locale)
  }
}
