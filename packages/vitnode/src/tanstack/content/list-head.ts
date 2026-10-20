import type { PluginRouteHead } from "@/routing";

import { getIntlRuntime } from "../i18n/runtime";

/**
 * A plugin route's `head` for a public list page, with the index rules every
 * list shares:
 *
 * - The plain list - no term, no filter, no other sort, the first page - is
 *   `index, follow`, with a canonical link and one `hreflang` alternate per
 *   locale at `pathname`.
 * - Any other state (`?q=`, a filter, another sort, `?page=2`) is
 *   `noindex, follow` with no canonical: it is a view of the same records, so
 *   it stays out of the index while a crawler still follows its links to
 *   each record. Records reach the index through their own pages and the
 *   sitemap, never through page 7 of a list.
 *
 * Pass the normalized state from `defineContentList().parseSearch`, so "plain"
 * means the same thing as the URL and the cache key. Universal.
 *
 * @example
 * ```ts
 * import { contentListPageHead } from "@vitnode/core/tanstack/content";
 *
 * head: ({ search, t }) =>
 *   contentListPageHead({
 *     description: t("@acme/news.list.desc"),
 *     pathname: "/news",
 *     search,
 *     title: t("@acme/news.list.title"),
 *   }),
 * ```
 */
export const contentListPageHead = ({
  description,
  locales,
  pathname,
  search,
  title,
}: {
  description?: string;
  /** The locales the page exists in. Defaults to every configured locale. */
  locales?: readonly string[];
  /** The list's internal (unprefixed) path, e.g. `/blog`. */
  pathname: string;
  search: object;
  title?: string;
}): PluginRouteHead => {
  const head: PluginRouteHead = {};
  if (title !== undefined) head.title = title;
  if (description !== undefined) head.description = description;

  if (Object.keys(search).length > 0) {
    head.robots = "noindex, follow";

    return head;
  }

  head.robots = "index, follow";
  head.alternates = Object.fromEntries(
    (locales ?? getIntlRuntime().localeRouting.locales).map(locale => [
      locale,
      pathname,
    ]),
  );

  return head;
};
