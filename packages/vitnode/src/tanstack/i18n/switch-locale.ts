import type { QueryClient } from "@tanstack/react-query";
import type { AnyRouter } from "@tanstack/react-router";

import { useRouter } from "@tanstack/react-router";

import type { LocaleRouting } from "@/lib/i18n/locale-routing";

import { serializeLocaleCookie } from "@/lib/i18n/locale-cookie";

import type { LocaleHostReader } from "./locale";

import { declaredLocaleAlternates } from "../metadata/alternates";
import { publicPathnameOf, readRequestHost, resolveLocale } from "./locale";
import { intlQueryOptions, loadedIntlNamespaces } from "./query";
import { getIntlRuntime } from "./runtime";

/**
 * A base for parsing a router href that carries no origin. Never requested, and
 * never rendered.
 */
const RELATIVE_BASE = "https://vitnode.invalid";

export type LocaleSwitchPlan =
  | { href: string; kind: "document" }
  | { href: string; kind: "history" }
  | { kind: "none" };

export interface LocaleSwitchInput {
  host?: string;
  internalHref: string;
  locale: string;
  localeRouting: LocaleRouting;
  matches: readonly { links?: unknown }[];
  publicHref: string;
}

interface InternalTarget {
  hash: string;
  pathname: string;
  search: string;
}

const internalTargetOf = ({
  internalHref,
  locale,
  localeRouting,
  matches,
}: LocaleSwitchInput): InternalTarget => {
  const current = new URL(internalHref, RELATIVE_BASE);
  const alternates = declaredLocaleAlternates(matches);
  const retained = { hash: current.hash, search: current.search };

  if (!alternates) return { ...retained, pathname: current.pathname };

  const alternate = alternates.get(locale);
  if (alternate === undefined) return { hash: "", pathname: "/", search: "" };

  let url: URL;
  try {
    url = new URL(alternate);
  } catch {
    return { hash: "", pathname: "/", search: "" };
  }

  return {
    ...retained,
    pathname: localeRouting.resolvePublicPathname(url.pathname, {
      host: url.host,
    }).internalPathname,
  };
};

export const planLocaleSwitch = (
  input: LocaleSwitchInput,
): LocaleSwitchPlan => {
  const { host, locale, localeRouting, publicHref } = input;

  if (!localeRouting.isSupportedLocale(locale)) return { kind: "none" };

  const { hash, pathname, search } = internalTargetOf(input);
  const target = localeRouting.publicUrlFor(pathname, locale, { host });
  const path = `${target.pathname}${search}${hash}`;

  if (target.origin) {
    return { href: `${target.origin}${path}`, kind: "document" };
  }

  const current = new URL(publicHref, RELATIVE_BASE);
  if (path === `${current.pathname}${current.search}${current.hash}`) {
    return { kind: "none" };
  }

  return { href: path, kind: "history" };
};

export interface SwitchLocaleOptions {
  navigateDocument?: (href: string) => void;
  readHost?: LocaleHostReader;
}

const planFor = (
  router: AnyRouter,
  locale: string,
  readHost: LocaleHostReader,
): LocaleSwitchPlan =>
  planLocaleSwitch({
    host: readHost(),
    internalHref: router.latestLocation.href,
    locale,
    localeRouting: getIntlRuntime().localeRouting,
    matches: router.state.matches,
    publicHref: router.latestLocation.publicHref,
  });

const warmMessages = async (
  router: AnyRouter,
  locale: string,
  readHost: LocaleHostReader,
) => {
  const queryClient = (
    router.options.context as undefined | { queryClient?: QueryClient }
  )?.queryClient;
  if (!queryClient) return;

  const current = resolveLocale(publicPathnameOf(router.latestLocation), {
    readHost,
  });

  await Promise.all(
    loadedIntlNamespaces(queryClient, current).map(async namespaces => {
      try {
        await queryClient.query({
          ...intlQueryOptions({ locale, namespaces }),
          staleTime: "static",
        });
      } catch {
        /* empty */
      }
    }),
  );
};

export const switchLocaleOn = async (
  router: AnyRouter,
  locale: string,
  {
    navigateDocument = href => globalThis.location.assign(href),
    readHost = readRequestHost,
  }: SwitchLocaleOptions = {},
): Promise<void> => {
  const { localeRouting } = getIntlRuntime();

  if (!localeRouting.isSupportedLocale(locale)) return;

  const plan = planFor(router, locale, readHost);
  if (plan.kind === "document") {
    navigateDocument(plan.href);

    return;
  }

  // Fetched before the URL moves, not after. The location store updates the
  // moment history does, so the provider re-renders under the new locale - and
  // therefore the new query key - while the root loader is still resolving it.
  // That is a suspend, and a suspend caused by a store update cannot be
  // deferred: the page would blank for a round trip. Warmed first, the switch
  // is a re-render with the messages already in hand.
  await warmMessages(router, locale, readHost);

  if (plan.kind === "history") router.history.push(plan.href);

  await router.invalidate();
};

/** {@link switchLocaleOn}, bound to the mounted router, plus the cookie write. */
export const useSwitchLocale = () => {
  const router = useRouter();

  return (locale: string) => {
    // Remembered for the routes whose URL carries no locale - `/admin` - and for
    // the next visit. `Secure` only over HTTPS: set on plain `http://localhost`
    // the browser drops it without a word, and the choice never sticks.
    if (
      getIntlRuntime().localeRouting.isSupportedLocale(locale) &&
      planFor(router, locale, readRequestHost).kind !== "document"
    ) {
      globalThis.document.cookie = serializeLocaleCookie(locale, {
        secure: globalThis.location.protocol === "https:",
      });
    }

    void switchLocaleOn(router, locale);
  };
};
