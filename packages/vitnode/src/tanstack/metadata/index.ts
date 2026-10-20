import type { VitNodeMetadata } from "@/lib/metadata";

import { formatPageTitle } from "@/lib/metadata";
import { getVitNodeConfig } from "@/vitnode.config";

import type { LocaleAlternates, RouteHeadLink } from "./alternates";

import { localeAlternateLinks } from "./alternates";

export type {
  LocaleAlternateLinksOptions,
  LocaleAlternates,
  RouteHeadLink,
} from "./alternates";
export {
  declaredLocaleAlternates,
  localeAlternateLinks,
  X_DEFAULT_HREFLANG,
} from "./alternates";

/** What a crawler may do with a page. */
export type RouteRobots =
  | "index, follow"
  | "noindex, follow"
  | "noindex, nofollow";

/** What kind of thing a page is, to a social card. */
export type RouteOpenGraphType = "article" | "website";

export interface RouteOpenGraph {
  /** The `<meta property="og:description">`. */
  description?: string;

  /** The `<meta property="og:title">`, used as is - no site-name suffix. */
  title?: string;
  /** `article` for a document, `website` for a landing page. */
  type?: RouteOpenGraphType;
}

/** What a page puts in its `<head>`. Every field is optional and emits nothing when unset. */
export interface RouteHeadOptions {
  /**
   * The page's internal path per locale. With `locale`, emits the canonical
   * link and `hreflang` alternates (see `localeAlternateLinks`).
   */
  alternates?: LocaleAlternates;
  /** The `<meta name="description">`, when the page has one. */
  description?: string;

  /** The locale being rendered; required for `alternates` to emit anything. */
  locale?: string;

  openGraph?: RouteOpenGraph;

  /** The `<meta name="robots">`. A deeper route's value replaces its parent's. */
  robots?: RouteRobots;
  /** The page's own title, already translated. The site name is appended (`Title - Site`). */
  title?: string;
}

export type RouteHeadMeta =
  | { content: string; name: string }
  | { content: string; property: string }
  | { title: string };

/** A TanStack Router `head` return value. */
export interface RouteHeadResult {
  links?: RouteHeadLink[];
  meta: RouteHeadMeta[];
}

const alternateLinksOf = (
  alternates: LocaleAlternates | undefined,
  locale: string | undefined,
): RouteHeadLink[] =>
  alternates && locale ? localeAlternateLinks({ alternates, locale }) : [];

const routeMeta = (
  metadata: VitNodeMetadata,
  {
    description,
    openGraph,
    robots,
    title,
  }: Pick<RouteHeadOptions, "description" | "openGraph" | "robots" | "title">,
): RouteHeadMeta[] => [
  ...(robots ? [{ content: robots, name: "robots" }] : []),
  ...(title ? [{ title: formatPageTitle(metadata, title) }] : []),
  ...(description ? [{ content: description, name: "description" }] : []),
  /*
   * Open Graph is `property`, not `name`, and that is not cosmetic: it is what
   * the specification uses and what every crawler looks for. TanStack Router
   * dedupes a meta tag by `name ?? property` and prefers the deepest matched
   * route, so a child overriding one of these works exactly as it does for
   * `robots` - see `buildTagsFromMatches` in `@tanstack/react-router`.
   */
  ...(openGraph?.title
    ? [{ content: openGraph.title, property: "og:title" }]
    : []),
  ...(openGraph?.description
    ? [{ content: openGraph.description, property: "og:description" }]
    : []),
  ...(openGraph?.type
    ? [{ content: openGraph.type, property: "og:type" }]
    : []),
];

/** {@link pageHead} with explicit site metadata, for code that runs before the config is registered. */
export const routeHead = (
  metadata: VitNodeMetadata,
  {
    alternates,
    description,
    locale,
    openGraph,
    robots,
    title,
  }: RouteHeadOptions = {},
): RouteHeadResult => {
  const links = alternateLinksOf(alternates, locale);

  return {
    ...(links.length > 0 ? { links } : {}),
    meta: routeMeta(metadata, { description, openGraph, robots, title }),
  };
};

/** Binds {@link routeHead} to one site's metadata. */
export const createRouteHead =
  (metadata: VitNodeMetadata) =>
  (options: RouteHeadOptions = {}) =>
    routeHead(metadata, options);

/**
 * A route's `head` from translated page data: title (suffixed with the site
 * name from `buildConfig({ metadata })`), description, robots, Open Graph and
 * locale alternates. Universal; use it in a route's `head`, written after
 * `loader` so `loaderData` is typed.
 *
 * @throws When the VitNode config has not been registered with `buildConfig`.
 *
 * @example
 * ```ts
 * import { pageHead } from "@vitnode/core/tanstack/metadata";
 *
 * head: ({ loaderData }) =>
 *   pageHead({
 *     title: loaderData?.title,
 *     description: loaderData?.description,
 *     robots: loaderData ? "index, follow" : "noindex, nofollow",
 *   }),
 * ```
 */
export const pageHead = (options: RouteHeadOptions = {}): RouteHeadResult =>
  routeHead(getVitNodeConfig().metadata, options);
