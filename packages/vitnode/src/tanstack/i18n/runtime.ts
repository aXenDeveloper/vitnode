import type { AbstractIntlMessages } from "use-intl";

import type { LocaleRouting } from "@/lib/i18n/locale-routing";
import type { VitNodeI18nConfig } from "@/lib/i18n/types";

import { localeRoutingFromConfig } from "@/lib/i18n/locale-routing";

/** One language's messages for one set of namespaces. */
export interface IntlMessages {
  locale: string;

  messages: AbstractIntlMessages;
}

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
  fetchMessages: IntlMessagesFetcher;
  /** The host's own `IntlProvider`. See {@link HostIntlProvider}. */
  hostIntlProvider?: HostIntlProvider;
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
