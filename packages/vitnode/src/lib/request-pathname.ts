/**
 * Request header the Proxy stamps with the path the visitor actually asked for
 * - pathname plus query string, locale prefix removed.
 *
 * A Server Component never sees that path on its own: by the time it renders,
 * the Proxy has rewritten the URL to the internal, locale-prefixed one, and
 * nothing in `headers()` carries the original. Anything that has to know where
 * the visitor was - sending an admin back to the page they were on after their
 * session expired, for one - reads it from here.
 */
export const VITNODE_PATHNAME_HEADER = "x-vitnode-pathname";

/**
 * Drops a leading locale segment, so `/pl/admin/core` and `/admin/core` both
 * come out as `/admin/core`.
 *
 * Stored paths stay locale-less on purpose: `Link` and `redirect` from
 * `@/lib/navigation` add the current locale back themselves, and a path that
 * already carried one would end up prefixed twice.
 */
export const stripLocalePrefix = (
  pathname: string,
  locales: string[],
): string => {
  for (const locale of locales) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1);
    }
  }

  return pathname;
};
