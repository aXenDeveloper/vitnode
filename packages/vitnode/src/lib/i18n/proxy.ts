import createMiddleware from "next-intl/middleware";

import type { VitNodeI18nConfig } from "./types";

/**
 * The next-intl Proxy (middleware), built from the app's i18n config alone.
 *
 * Deliberately takes the i18n block rather than the whole `VitNodeConfig`: the
 * Proxy runs outside the App Directory, where `next/root-params` - reached
 * through the request config - cannot be imported. Keeping `vitnode.config.ts`
 * out of the Proxy's module graph is what lets the request config read root
 * params at all.
 */
export const createVitNodeProxy = (i18n: VitNodeI18nConfig) =>
  createMiddleware({
    locales: i18n.locales.map(locale => locale.code),
    defaultLocale: i18n.defaultLocale,
    localePrefix: i18n.localePrefix ?? "as-needed",
  });
