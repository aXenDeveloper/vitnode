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
