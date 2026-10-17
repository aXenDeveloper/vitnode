import { notFound, redirect } from "@tanstack/react-router";

import type { PluginRouteHead } from "@/routing";

import { stripHtml } from "@/lib/strip-html";

const DESCRIPTION_MAX_LENGTH = 160;

/** One translation of a delivered page, as an internal (unprefixed) path. */
export interface ContentDeliveryPageAlternate {
  internalPath: string;
  locale: string;
}

/** The SEO data a Content Engine delivery answer carries for one page. */
export interface ContentDeliveryPageMetadata {
  /** The page in every other locale it is published in. */
  alternates: readonly ContentDeliveryPageAlternate[];
  canonicalInternalPath: null | string;
  /** The locale the content was resolved in, which may be a fallback locale. */
  locale: null | string;
  robots: null | { follow: boolean; index: boolean };
  /** SEO overrides; `description` may contain HTML. */
  seo: { description: null | string; title: null | string };
}

/** What resolving a public content URL answered: the page, a redirect, or nothing. */
export type ContentDeliveryPageResolution =
  | (ContentDeliveryPageMetadata & { type: "content" })
  | { location: string; status: number; type: "redirect" }
  | { type: "not_found" };

/**
 * Returns `item`, or throws TanStack Router's `notFound()` when it is `null` or
 * `undefined` - so a route `loader` that read a missing record renders the
 * not-found page instead of an empty one.
 *
 * @throws TanStack Router's `notFound()` for a missing item.
 */
export const contentPageItem = <TItem>(
  item: null | TItem | undefined,
): TItem => {
  // oxlint-disable-next-line typescript/only-throw-error
  if (item === null || item === undefined) throw notFound();

  return item;
};

/**
 * Turns a Content Engine delivery answer into a route loader result: follows a
 * `redirect` (old slug, canonical locale path) with its status code, throws
 * `notFound()` for `not_found` or a missing item, and otherwise returns the item
 * with the page metadata for {@link contentDeliveryPageHead}.
 *
 * Call it in a `loader`, where TanStack Router handles the thrown redirect and
 * not-found.
 *
 * @throws TanStack Router's `redirect()` or `notFound()`.
 *
 * @example
 * ```ts
 * import { contentDeliveryPage, contentDeliveryPageHead } from "@vitnode/core/tanstack/content";
 * import { defineRoute } from "@vitnode/core/tanstack/plugin-routes";
 *
 * export const route = defineRoute({
 *   load: async ({ context, params }) =>
 *     contentDeliveryPage(
 *       await context.queryClient.query(
 *         blogPostQueryOptions({ locale: context.locale, slug: params.slug }),
 *       ),
 *     ),
 *   head: ({ loaderData }) =>
 *     contentDeliveryPageHead(loaderData?.metadata, { title: loaderData?.item.title }),
 * });
 * ```
 */
export const contentDeliveryPage = <
  TResolution extends ContentDeliveryPageResolution,
  TItem,
>({
  item,
  resolution,
}: {
  item: null | TItem | undefined;
  resolution: TResolution;
}): { item: TItem; metadata: Extract<TResolution, { type: "content" }> } => {
  if (resolution.type === "redirect") {
    // oxlint-disable-next-line typescript/only-throw-error
    throw redirect({
      href: resolution.location,
      statusCode: resolution.status,
    });
  }

  // oxlint-disable-next-line typescript/only-throw-error
  if (resolution.type === "not_found") throw notFound();

  return {
    item: contentPageItem(item),
    metadata: resolution as Extract<TResolution, { type: "content" }>,
  };
};

const metaDescription = (value: null | string): string | undefined => {
  if (value === null) return undefined;

  const text = stripHtml(value);
  if (text === "") return undefined;
  if (text.length <= DESCRIPTION_MAX_LENGTH) return text;

  const cut = text.slice(0, DESCRIPTION_MAX_LENGTH - 1);
  const lastSpace = cut.lastIndexOf(" ");

  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
};

const internalAlternates = (
  metadata: ContentDeliveryPageMetadata,
): Record<string, string> | undefined => {
  const entries = metadata.alternates.map((alternate): [string, string] => [
    alternate.locale,
    alternate.internalPath,
  ]);

  if (
    entries.length === 0 &&
    metadata.locale !== null &&
    metadata.canonicalInternalPath !== null
  ) {
    entries.push([metadata.locale, metadata.canonicalInternalPath]);
  }

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

/**
 * A plugin route's `head` for a delivered content page: the SEO title (or
 * `title` as fallback), a plain-text description cut to 160 characters, the
 * locale alternates, and `noindex, nofollow` when the page must not be
 * indexed. Returns just `title` while there is no metadata yet.
 */
export const contentDeliveryPageHead = (
  metadata: ContentDeliveryPageMetadata | undefined,
  { title }: { title?: string } = {},
): PluginRouteHead => {
  if (metadata === undefined) return title === undefined ? {} : { title };

  const head: PluginRouteHead = {};
  const pageTitle = metadata.seo.title ?? title;
  const description = metaDescription(metadata.seo.description);
  const alternates = internalAlternates(metadata);

  if (pageTitle !== undefined) head.title = pageTitle;
  if (description !== undefined) head.description = description;
  if (alternates !== undefined) head.alternates = alternates;
  if (metadata.robots?.index === false) head.robots = "noindex, nofollow";

  return head;
};
