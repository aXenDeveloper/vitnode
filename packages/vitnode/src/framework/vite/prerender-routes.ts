import type { LocaleConfig, VitNodeI18nConfig } from "@/lib/i18n/types";

import { localeRoutingFromConfig } from "@/lib/i18n/locale-routing";

export interface PrerenderRoutesOptions {
  i18n: Pick<
    VitNodeI18nConfig,
    "defaultLocale" | "domains" | "localePrefix" | "routePaths"
  > & { locales: LocaleConfig[] };
  paths: readonly string[];
}

export class PrerenderDomainsError extends Error {
  constructor() {
    super(
      "Prerendering writes one file per path, so it cannot answer per-domain locales. Remove `i18n.domains` or keep these pages server-rendered.",
    );
    this.name = "PrerenderDomainsError";
  }
}

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
