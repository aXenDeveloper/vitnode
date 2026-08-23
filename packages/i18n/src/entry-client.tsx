import type { ComponentProps, ReactNode } from "react";

import {
  keepPreviousData,
  queryOptions,
  useQuery,
} from "@tanstack/react-query";
import {
  Link,
  type RegisteredRouter,
  useRouterState,
} from "@tanstack/react-router";
import { IntlProvider } from "use-intl";

import type { Locale } from "./core/shared";
import type { Messages } from "./messages";

import { getCurrentLocale, localizedPath } from "./core/client";
import {
  defaultLocale,
  defaultTimeZone,
  isValidLocale,
  shouldIgnorePath,
  supportedLocales,
} from "./core/shared";
import { loadMessages } from "./messages";

export {
  deLocalizeUrl,
  getCurrentLocale,
  localizedPath,
  localizeUrl,
  readCookieLocale,
} from "./core/client";
export {
  defaultLocale,
  defaultTimeZone,
  extractLocaleFromPath,
  ignoredPathsRegex,
  isValidLocale,
  type Locale,
  LOCALE_COOKIE,
  shouldIgnorePath,
  supportedLocales,
} from "./core/shared";
export { loadMessages, type Messages } from "./messages";

/**
 * Messages never change for the lifetime of the tab, so once a locale has been
 * fetched there is nothing to revalidate or evict.
 */
export const messagesQueryOptions = (locale: Locale) =>
  queryOptions({
    gcTime: Infinity,
    queryFn: async () => await loadMessages(locale),
    queryKey: ["i18n", "messages", locale] as const,
    staleTime: Infinity,
  });

/** The public pathname currently on screen, locale prefix included. */
const usePublicPathname = (): string =>
  useRouterState({
    select: state =>
      new URL(state.location.publicHref, "http://localhost").pathname,
  });

/**
 * The locale currently on screen.
 *
 * `useRouterState` is what makes this reactive: the locale lives in the public
 * URL rather than in the router's own path space, so a navigation is what has
 * to trigger the re-read.
 *
 * Ignored paths carry no prefix, so there the cookie is the only source - which
 * is exactly what `getCurrentLocale` reads on both sides of the wire.
 */
export const useLocale = (): Locale => {
  const pathname = usePublicPathname();

  if (shouldIgnorePath(pathname)) return getCurrentLocale();

  const segment = pathname.split("/")[1];

  return isValidLocale(segment) ? segment : defaultLocale;
};

export interface I18nProviderProps {
  children: ReactNode;
  /**
   * The locale and messages the server rendered with.
   *
   * Passing them in is what keeps the first client render identical to the SSR
   * output: the query starts already resolved instead of suspending and
   * swapping the strings in afterwards.
   */
  initial: { locale: Locale; messages: Messages };
}

export const I18nProvider = ({ children, initial }: I18nProviderProps) => {
  const locale = useLocale();
  const { data } = useQuery({
    ...messagesQueryOptions(locale),
    initialData: locale === initial.locale ? initial.messages : undefined,
    // Keeps the previous locale's strings up for the one render a newly chosen
    // locale takes to load, rather than blanking the page.
    placeholderData: keepPreviousData,
  });

  return (
    <IntlProvider
      locale={locale}
      messages={data ?? initial.messages}
      timeZone={defaultTimeZone}
    >
      {children}
    </IntlProvider>
  );
};

type AppFileRouteTypes =
  RegisteredRouter["routeTree"]["types"]["fileRouteTypes"];

type AppTo = AppFileRouteTypes extends { to: infer TTo extends string }
  ? TTo
  : never;

/** Every route target except the ones that are never given a locale prefix. */
export type LocalizedTo = Exclude<AppTo, `/admin${string}` | `/api${string}`>;

export type LocalizedLinkProps = Omit<ComponentProps<typeof Link>, "to"> & {
  to: LocalizedTo;
};

/**
 * `Link`, narrowed to the routes that actually get localized.
 *
 * Targets are inferred from the app's generated `FileRouteTypes`, so an unknown
 * path is a type error - and so is `/admin`, which stays a plain `<Link>`.
 *
 * The href itself needs no work here: the router's `output` rewrite is what
 * turns `/about` into `/pl/about`.
 */
export const LocalizedLink = ({ to, ...props }: LocalizedLinkProps) => (
  <Link to={to} {...props} />
);

/**
 * Switches locale.
 *
 * This navigates the document rather than the router on purpose. The locale is
 * server-owned state - it lives in the URL prefix and in the cookie - so a real
 * request is what moves all of it at once, and it keeps working with JavaScript
 * disabled. The request middleware syncs the cookie on the way through.
 */
export const LocaleSwitcher = () => {
  const locale = useLocale();
  const pathname = usePublicPathname();

  return (
    <nav aria-label="Language" className="flex items-center gap-2">
      {supportedLocales.map(code => (
        <a
          aria-current={code === locale ? "page" : undefined}
          className="text-primary rounded-md px-2 py-1 underline aria-[current]:no-underline"
          href={localizedPath(pathname, code)}
          key={code}
        >
          {code}
        </a>
      ))}
    </nav>
  );
};
