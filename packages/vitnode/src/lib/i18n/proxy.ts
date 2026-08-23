import type { NextRequest } from "next/server";

import createMiddleware from "next-intl/middleware";

import type { VitNodeI18nConfig } from "./types";

import {
  stripLocalePrefix,
  VITNODE_PATHNAME_HEADER,
} from "../request-pathname";

/**
 * The next-intl Proxy (middleware), built from the app's i18n config alone.
 *
 * Deliberately takes the i18n block rather than the whole `VitNodeConfig`: the
 * Proxy runs outside the App Directory, where `next/root-params` - reached
 * through the request config - cannot be imported. Keeping `vitnode.config.ts`
 * out of the Proxy's module graph is what lets the request config read root
 * params at all.
 *
 * It also stamps {@link VITNODE_PATHNAME_HEADER} onto the request, which is the
 * only place the requested path is still intact: next-intl rewrites the URL
 * from here on, and it copies the request headers onto the response it forwards,
 * so a Server Component can read the header back out of `headers()`.
 */
export const createVitNodeProxy = (i18n: VitNodeI18nConfig) => {
  const locales = i18n.locales.map(locale => locale.code);
  const proxy = createMiddleware({
    locales,
    defaultLocale: i18n.defaultLocale,
    localePrefix: i18n.localePrefix ?? "as-needed",
  });

  return (request: NextRequest) => {
    request.headers.set(
      VITNODE_PATHNAME_HEADER,
      stripLocalePrefix(request.nextUrl.pathname, locales) +
        request.nextUrl.search,
    );

    return proxy(request);
  };
};
