import type { AbstractIntlMessages } from "use-intl";

import type { LocaleRouting } from "@/lib/i18n/locale-routing";
import type { VitNodeI18nConfig } from "@/lib/i18n/types";

import { localeRoutingFromConfig } from "@/lib/i18n/locale-routing";

/** One language's messages for one set of namespaces. */
export interface IntlMessages {
  locale: string;
  /**
   * The picked message tree, as `use-intl`'s own shape rather than a bare
   * `object`.
   *
   * It matters at both ends. `createTranslator` constrains its messages to an
   * indexable type, so an `object` there collapses every key it could translate
   * to `never` - which is how a route resolves its own metadata strings. And a
   * server function's return type has to prove itself serializable, which
   * `Record<string, unknown>` cannot: `unknown` might be a function. A tree of
   * strings can.
   */
  messages: AbstractIntlMessages;
}

/**
 * How the host fetches one language's messages.
 *
 * The one thing this package cannot own. Reading messages means reading JSON out
 * of each package's `dist`, so the call has to reach a server - and in TanStack
 * Start that means `createServerFn`, which the Start compiler must transform in
 * *both* the client and the server bundle. This package is externalised from the
 * host's SSR pass, so its code reaches the server un-compiled and a server
 * function declared here would silently resolve to `undefined` during SSR. See
 * `packages/vitnode/src/tanstack/boundary.test.ts`.
 *
 * So the host declares the server function and hands it over as this, which is
 * an ordinary async function on both sides of the render.
 */
export type IntlMessagesFetcher = (input: {
  locale: string;
  namespaces: readonly string[];
}) => Promise<IntlMessages>;

/**
 * A second `IntlProvider`, from the *host application's* copy of `use-intl`.
 *
 * Optional, and only ever load-bearing under `vite dev`. This package is
 * external to a host's SSR pass (`ssr.external` in its `vite.config.ts`), so
 * Node loads it and resolves `use-intl` to that package's `default` build, while
 * the host's own source goes through Vite's module runner and resolves the same
 * dependency with the `development` condition. Same version, same
 * `node_modules` entry, two files - and `createContext` runs once per file, so
 * they are two React contexts. Everything this package renders reads the first;
 * anything the host renders from its own `useTranslations` reads the second.
 *
 * `RouteMessages` can only mount the record it was itself loaded with, so the
 * host hands its own in here - once, beside the other registrations that cannot
 * live in a package - and every `RouteMessages` in the tree provides both. A
 * production build resolves the dependency once and the two collapse into one
 * component, where the extra wrapper is an identical provider around identical
 * props and changes nothing.
 *
 * Leaving it out is safe in the sense that nothing throws at registration time,
 * and unsafe in the sense that the first host component to call
 * `useTranslations` throws "No intl context found" during a dev render. See
 * `provider-records.test.ts`.
 */
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
  /**
   * Explicit, because an app renders on a server: without one, `use-intl`
   * formats dates in whatever zone the server happens to run in and warns that
   * the client will disagree.
   */
  timeZone?: string;
}

/**
 * The host's answer, held for the process.
 *
 * Module-scope mutable state, which is worth justifying rather than hiding. What
 * it holds is not request state and never varies between requests: an app's
 * language list, its default, its time zone, and a reference to the server
 * function that fetches messages. All four are decided once when the app is
 * built. A second request cannot see a different value, so the usual objection
 * to a module-level singleton on a server - one visitor's state leaking into
 * another's render - does not apply.
 *
 * It is the same shape `buildConfig` / `getVitNodeConfig` already uses for the
 * app config, for the same reason: framework-owned code needs the app's values
 * without every route prop-drilling them. The difference is that this one is
 * also read in the browser, so it is registered from a module both the router
 * entry and the start entry import rather than from the server-only config.
 */
let runtime: IntlRuntime | undefined;

/**
 * Hands this package the app's languages and its message fetcher, once.
 *
 * Call it at module scope from a module the router entry imports - that is what
 * makes it impossible for a route to run before it. Everything else in
 * `@vitnode/core/tanstack/i18n` reads what it registers, so a route file imports
 * `RouteMessages` and `intlQueryOptions` straight from the package with no
 * configuration of its own.
 *
 * Returns the derived runtime as well as registering it, so the caller gets
 * `localeRouting` and `isLocale` back without deriving them a second time.
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
 * What {@link configureIntl} registered.
 *
 * Throws rather than falling back to a default language, and the message names
 * the fix: an app that reached here without configuring is one whose router
 * entry does not import its i18n module, and every string it renders would
 * otherwise be silently English.
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
