export const normalizeUrl = (url: string): string =>
  url.endsWith("/") && url.length > 1 ? url.slice(0, -1) : url;

/**
 * Whether an href leaves this application entirely.
 *
 * A plugin's `admin.nav` entry may point anywhere - a docs site, a status page,
 * an external dashboard - and such an href is not a *path*, which is what every
 * `LinkComponent` in VitNode is documented to take. Handing one to `next-intl`'s
 * `Link` or to TanStack Router's asks a router to localize and match an absolute
 * URL, and both answer with something broken rather than with the page the
 * plugin author named.
 *
 * So the shell classifies first and renders a plain anchor for these, which is
 * what an external destination always wanted: no locale prefix, no route lookup,
 * no framework involved.
 *
 * ## What counts
 *
 * Anything with a scheme (`https:`, `mailto:`, `tel:`) and anything
 * protocol-relative (`//host/path`), because the browser resolves the second
 * against the current scheme and lands on another origin just the same.
 *
 * A path is *not* external, including one with a colon later in it
 * (`/admin/core/users/a:b`) - hence the anchored pattern rather than a bare
 * `includes(":")`.
 */
export const isExternalHref = (href: string): boolean =>
  href.startsWith("//") || /^[a-z][a-z0-9+.-]*:/i.test(href);
