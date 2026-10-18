import type { AbstractIntlMessages } from "use-intl";

import type { LocaleRouting } from "@/lib/i18n/locale-routing";
import type { VitNodeI18nConfig } from "@/lib/i18n/types";

import { localeRoutingFromConfig } from "@/lib/i18n/locale-routing";

/** One language's messages for one set of namespaces. */
export interface IntlMessages {
  locale: string;

  messages: AbstractIntlMessages;
}

/**
 * Loads one locale's messages for a set of namespaces. Usually a server
 * function wrapping `createIntlMessagesLoader`, so locale files stay on the
 * server.
 */
export type IntlMessagesFetcher = (input: {
  locale: string;
  namespaces: readonly string[];
}) => Promise<IntlMessages>;

export type HostIntlProvider = React.ComponentType<{
  children: React.ReactNode;
  locale: string;
  messages: AbstractIntlMessages;
  timeZone?: string;
}>;

export interface ConfigureIntlOptions {
  /**
   * The TanStack Query fetcher for messages, run on the server and in the
   * browser when a locale and namespace set is not cached yet.
   */
  fetchMessages: IntlMessagesFetcher;
  /** The host's own `IntlProvider`. See {@link HostIntlProvider}. */
  hostIntlProvider?: HostIntlProvider;
  /** The app's `vitNodeConfig.i18n`: locales, prefixes, domains, time zone. */
  i18n: VitNodeI18nConfig;
}

/** Everything the rest of this namespace reads, derived once from the host. */
export interface IntlRuntime {
  defaultLocale: string;
  fetchMessages: IntlMessagesFetcher;
  /** The host's own `IntlProvider`, if it registered one. */
  hostIntlProvider?: HostIntlProvider;
  /** Narrows a string - a URL segment, a cookie, a `<select>` value. */
  isLocale: (value: null | string | undefined) => boolean;
  localeRouting: LocaleRouting;

  timeZone?: string;
}

let runtime: IntlRuntime | undefined;

/**
 * Registers the app's locale rules and message loader for every VitNode
 * route, link and `RouteMessages` in this process. Call it once, at module
 * scope, in a module the router entry imports - before the router is created.
 *
 * @example
 * ```ts
 * // src/lib/i18n.ts
 * import { createServerFn } from "@tanstack/react-start";
 * import { configureIntl, validateIntlInput } from "@vitnode/core/tanstack/i18n";
 *
 * const getIntlMessages = createServerFn()
 *   .validator(validateIntlInput)
 *   .handler(async ({ data }) => await loadIntlMessages(data));
 *
 * export const { localeRouting } = configureIntl({
 *   fetchMessages: async input => await getIntlMessages({ data: input }),
 *   i18n: vitNodeConfig.i18n,
 * });
 * ```
 */
export const configureIntl = ({
  fetchMessages,
  hostIntlProvider,
  i18n,
}: ConfigureIntlOptions): IntlRuntime => {
  const localeRouting = localeRoutingFromConfig(i18n);

  runtime = {
    defaultLocale: localeRouting.defaultLocale,
    fetchMessages,
    hostIntlProvider,
    isLocale: value => localeRouting.isSupportedLocale(value),
    localeRouting,
    timeZone: i18n.timeZone,
  };

  return runtime;
};

/**
 * The runtime {@link configureIntl} registered: default locale, locale routing,
 * time zone and the message fetcher. Universal.
 *
 * @throws When `configureIntl` has not run yet.
 */
export const getIntlRuntime = (): IntlRuntime => {
  if (!runtime) {
    throw new Error(
      "VitNode i18n is not configured - call `configureIntl({ fetchMessages, i18n })` from a module your router entry imports.",
    );
  }

  return runtime;
};

/** Drops the registered runtime. Exported for tests. */
export const resetIntlRuntime = () => {
  runtime = undefined;
};
