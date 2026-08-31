/**
 * VitNode's i18n runtime for a TanStack Start host.
 *
 * The whole of it: locale routing over the router, the message query, the
 * language switcher and the provider pair a route mounts. A host supplies two
 * things through {@link configureIntl} - its language list and a server function
 * that fetches messages - and imports everything else from here.
 *
 * Nothing in this barrel touches a request. The server half - the message
 * loading engine and the request-time redirect plan - is
 * `@vitnode/core/tanstack/i18n/server`, and is deliberately not re-exported:
 * this one is imported by route components and so is in the browser bundle.
 */
export {
  createLocaleRewrite,
  localizeHref,
  publicPathnameOf,
  resolveLocale,
  useLocale,
} from "./locale";
export {
  GLOBAL_NAMESPACE,
  intlQueryOptions,
  loadedIntlNamespaces,
  MAX_NAMESPACE_DEPTH,
  MAX_NAMESPACE_LENGTH,
  MAX_NAMESPACES,
  validateIntlInput,
} from "./query";
export { RouteMessages } from "./route-messages";
export type {
  ConfigureIntlOptions,
  HostIntlProvider,
  IntlMessages,
  IntlMessagesFetcher,
  IntlRuntime,
} from "./runtime";
export { configureIntl, getIntlRuntime, resetIntlRuntime } from "./runtime";
export { switchLocaleOn, useSwitchLocale } from "./switch-locale";
