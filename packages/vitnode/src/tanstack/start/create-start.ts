import type { AnyRequestMiddleware } from "@tanstack/react-start";

import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

import type { LocaleConfig } from "@/lib/i18n/types";
import type { VitNodeConfig } from "@/vitnode.config";

import { localeRoutingFromConfig } from "@/lib/i18n/locale-routing";

import { createLocaleRequestMiddleware } from "./locale-middleware";

export interface VitNodeStartOptions<
  AppLocales extends LocaleConfig[] = LocaleConfig[],
> {
  /**
   * The app's shared config, handed over rather than read from a registry.
   *
   * Request middleware runs before route matching and before anything else in
   * this package has necessarily been imported, so a factory that read
   * `getVitNodeConfig()` would depend on which entry file Node happened to
   * evaluate first. The locale routing runtime is derived from `config.i18n`
   * here, once.
   */
  config: VitNodeConfig<AppLocales>;
  /**
   * The app's own request middleware, appended after VitNode's.
   *
   * For things an installation genuinely owns - a request id, a tracing span, a
   * maintenance-mode gate. It cannot displace or precede CSRF and locale
   * handling; see the ordering note on {@link createVitNodeStart}.
   */
  requestMiddleware?: readonly AnyRequestMiddleware[];
}

/**
 * A VitNode app's Start instance - the whole of `src/start.ts`.
 *
 * ## Why CSRF is not optional
 *
 * Start installs its own CSRF middleware *only* while an app declares no
 * `requestMiddleware` at all. The moment an app has a `src/start.ts` with a
 * list, that default is replaced by whatever the list holds - so an app that
 * writes its own pipeline and forgets CSRF exposes every server function as an
 * unauthenticated cross-site endpoint, silently. That is the failure this
 * factory exists to make impossible: the middleware is built here, first, and an
 * app cannot omit it, reorder it, or get in front of it.
 *
 * The `filter` keeps it to `handlerType === "serverFn"`. Server functions are
 * same-origin RPC; page navigations are not, and validating `Sec-Fetch-Site` on
 * a top-level cross-site link would reject ordinary inbound traffic.
 *
 * ## Order
 *
 *     1. CSRF          rejects a cross-site RPC before anything reads it
 *     2. locale        canonical redirects, the locale cookie, document caching
 *     3. the app's     whatever `requestMiddleware` lists, in order
 *
 * Locale handling sits second because a redirect ends the request: an app
 * middleware that ran before it would run twice for every visitor arriving at
 * `/en/discover`, once for the redirect and once for `/discover`.
 */
export const createVitNodeStart = <AppLocales extends LocaleConfig[]>({
  config,
  requestMiddleware = [],
}: VitNodeStartOptions<AppLocales>) => {
  const localeRouting = localeRoutingFromConfig(config.i18n);

  return createStart(() => ({
    requestMiddleware: [
      createCsrfMiddleware({ filter: ctx => ctx.handlerType === "serverFn" }),
      createLocaleRequestMiddleware(localeRouting),
      ...requestMiddleware,
    ],
  }));
};
