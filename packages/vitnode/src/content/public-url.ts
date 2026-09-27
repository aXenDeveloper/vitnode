import type {
  LocalePublicUrl,
  LocaleRouting,
} from "../lib/i18n/locale-routing";

import { normalizeContentLocale } from "./locale";

export type ContentLocaleRouting = Pick<
  LocaleRouting,
  | "canonicalUrlFor"
  | "defaultLocale"
  | "locales"
  | "publicUrlFor"
  | "resolvePublicPathname"
>;

export type ContentPublicUrl = LocalePublicUrl;

export const contentRoutingLocale = (
  routing: ContentLocaleRouting,
  locale: string,
): string | undefined => {
  const wanted = normalizeContentLocale(locale);

  return routing.locales.find(
    candidate => normalizeContentLocale(candidate) === wanted,
  );
};

export const contentPublicUrl = ({
  host,
  internalPath,
  locale,
  routing,
}: {
  host?: null | string;
  internalPath: string;
  locale: string;
  routing: ContentLocaleRouting;
}): ContentPublicUrl | null => {
  const normalized = normalizeContentLocale(locale);
  if (normalized === "") return null;

  const routed = contentRoutingLocale(routing, normalized);
  if (routed === undefined) {
    return {
      pathname: `/${encodeURIComponent(normalized)}${internalPath === "/" ? "" : internalPath}`,
    };
  }

  return host === undefined
    ? routing.canonicalUrlFor(internalPath, routed)
    : routing.publicUrlFor(internalPath, routed, { host });
};

export const contentPublicHref = (url: ContentPublicUrl): string =>
  url.origin === undefined
    ? url.pathname
    : new URL(url.pathname, url.origin).toString();
