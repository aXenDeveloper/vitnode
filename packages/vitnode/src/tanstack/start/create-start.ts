import type { AnyRequestMiddleware } from "@tanstack/react-start";

import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

import type { LocaleConfig } from "@/lib/i18n/types";
import type { VitNodeConfig } from "@/vitnode.config";

import { localeRoutingFromConfig } from "@/lib/i18n/locale-routing";

import type { DocumentSecurityHeaders } from "./document-headers";

import { resolveDocumentSecurityHeaders } from "./document-headers";
import { createLocaleRequestMiddleware } from "./locale-middleware";

export interface VitNodeStartOptions<
  AppLocales extends LocaleConfig[] = LocaleConfig[],
> {
  /** The app's `vitNodeConfig`; its `i18n` drives locale redirects. */
  config: VitNodeConfig<AppLocales>;

  /** The app's own request middleware, run after VitNode's. */
  requestMiddleware?: readonly AnyRequestMiddleware[];
  /**
   * Overrides of the security headers set on HTML documents, by header name.
   * `false` removes a default. Defaults include `x-frame-options: SAMEORIGIN`
   * and `referrer-policy: strict-origin-when-cross-origin`.
   */
  securityHeaders?: DocumentSecurityHeaders;
}

/**
 * The app's TanStack Start instance with VitNode's request middleware: CSRF
 * protection for server functions; locale redirects and the locale cookie;
 * `private, no-store` caching and security headers on HTML documents (the
 * page cache sets its own cache headers on pages it serves); then
 * `requestMiddleware`.
 *
 * @example
 * ```ts
 * // src/start.ts
 * import { createVitNodeStart } from "@vitnode/core/tanstack/start";
 *
 * import { vitNodeConfig } from "@/vitnode.config";
 *
 * export const startInstance = createVitNodeStart({ config: vitNodeConfig });
 * ```
 */
export const createVitNodeStart = <AppLocales extends LocaleConfig[]>({
  config,
  requestMiddleware = [],
  securityHeaders,
}: VitNodeStartOptions<AppLocales>) => {
  const localeRouting = localeRoutingFromConfig(config.i18n);
  const documentHeaders = resolveDocumentSecurityHeaders(securityHeaders);

  return createStart(() => ({
    requestMiddleware: [
      createCsrfMiddleware({ filter: ctx => ctx.handlerType === "serverFn" }),
      createLocaleRequestMiddleware(localeRouting, documentHeaders),
      ...requestMiddleware,
    ],
  }));
};
