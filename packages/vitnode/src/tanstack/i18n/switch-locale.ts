import type { QueryClient } from "@tanstack/react-query";
import type { AnyRouter } from "@tanstack/react-router";

import { useRouter } from "@tanstack/react-router";

import { serializeLocaleCookie } from "@/lib/i18n/locale-cookie";

import { publicPathnameOf, resolveLocale } from "./locale";
import { intlQueryOptions, loadedIntlNamespaces } from "./query";
import { getIntlRuntime } from "./runtime";

/**
 * A base for parsing a router href that carries no origin. Never requested, and
 * never rendered.
 */
const RELATIVE_BASE = "https://vitnode.invalid";

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
const warmMessages = async (router: AnyRouter, locale: string) => {
  const { queryClient } = router.options.context as {
    queryClient?: QueryClient;
  };
  if (!queryClient) return;

  const current = resolveLocale(publicPathnameOf(router.latestLocation));

  await Promise.all(
    loadedIntlNamespaces(queryClient, current).map(async namespaces => {
      try {
        await queryClient.ensureQueryData(
          intlQueryOptions({ locale, namespaces }),
        );
      } catch {
        /* empty */
      }
    }),
  );
};

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
  locale: string,
): Promise<void> => {
  const { localeRouting } = getIntlRuntime();

  if (!localeRouting.isSupportedLocale(locale)) return;

  // Fetched before the URL moves, not after. The location store updates the
  // moment history does, so the provider re-renders under the new locale - and
  // therefore the new query key - while the root loader is still resolving it.
  // That is a suspend, and a suspend caused by a store update cannot be
  // deferred: the page would blank for a round trip. Warmed first, the switch
  // is a re-render with the messages already in hand.
  await warmMessages(router, locale);

  const current = new URL(router.latestLocation.publicHref, RELATIVE_BASE);
  const next = localeRouting.localizeUrl(current, locale);

  if (next.href !== current.href) {
    router.history.push(`${next.pathname}${next.search}${next.hash}`);
  }

  await router.invalidate();
};

/** {@link switchLocaleOn}, bound to the mounted router, plus the cookie write. */
export const useSwitchLocale = () => {
  const router = useRouter();

  return (locale: string) => {
    // Remembered for the routes whose URL carries no locale - `/admin` - and for
    // the next visit. `Secure` only over HTTPS: set on plain `http://localhost`
    // the browser drops it without a word, and the choice never sticks.
    if (getIntlRuntime().localeRouting.isSupportedLocale(locale)) {
      globalThis.document.cookie = serializeLocaleCookie(locale, {
        secure: globalThis.location.protocol === "https:",
      });
    }

    void switchLocaleOn(router, locale);
  };
};
