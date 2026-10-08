import type { LocaleRouting } from "./locale-routing";

import { readLocaleCookie } from "./locale-cookie";

export interface UrlLocaleToRememberInput {
  cookieHeader: null | string | undefined;
  host: string | undefined;
  localeRouting: LocaleRouting;
  pathname: string;
}

export const urlLocaleToRemember = ({
  cookieHeader,
  host,
  localeRouting,
  pathname,
}: UrlLocaleToRememberInput): string | undefined => {
  if (localeRouting.shouldIgnoreLocalePath(pathname)) return undefined;

  const urlLocale = localeRouting.extractLocaleFromPath(pathname, { host });
  if (!urlLocale || urlLocale === readLocaleCookie(cookieHeader)) {
    return undefined;
  }

  return urlLocale;
};
