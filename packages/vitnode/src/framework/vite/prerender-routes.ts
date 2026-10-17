import type { LocaleConfig, VitNodeI18nConfig } from "@/lib/i18n/types";

import { localeRoutingFromConfig } from "@/lib/i18n/locale-routing";

export interface PrerenderRoutesOptions {
  /** The app's `i18n` config, usually `vitNodeConfig.i18n`. */
  i18n: Pick<
    VitNodeI18nConfig,
    "defaultLocale" | "domains" | "localePrefix" | "routePaths"
  > & { locales: LocaleConfig[] };
  /** Canonical, unlocalized paths to prerender, e.g. `/` and `/docs`. */
  paths: readonly string[];
}

/** Thrown by {@link prerenderRoutes} when the app serves locales by domain. */
export class PrerenderDomainsError extends Error {
  constructor() {
    super(
      "Prerendering writes one file per path, so it cannot answer per-domain locales. Remove `i18n.domains` or keep these pages server-rendered.",
    );
    this.name = "PrerenderDomainsError";
  }
}

/**
 * Expands canonical paths into the public URL of each enabled locale -
 * prefixes and translated `routePaths` included - for Nitro's
 * `prerender.routes`. Duplicates are removed.
 *
 * @throws {@link PrerenderDomainsError} when `i18n.domains` is set.
 *
 * @example
 * ```ts
 * nitro({
 *   prerender: {
 *     routes: prerenderRoutes({ i18n: vitNodeConfig.i18n, paths: ["/", "/about"] }),
 *   },
 * });
 * ```
 */
export const prerenderRoutes = ({
  i18n,
  paths,
}: PrerenderRoutesOptions): string[] => {
  const localeRouting = localeRoutingFromConfig(i18n);
  if (localeRouting.domains.length > 0) throw new PrerenderDomainsError();

  const localized = localeRouting.locales.flatMap(locale =>
    paths.map(path => localeRouting.localizePathname(path, locale)),
  );

  return [...new Set(localized)];
};
