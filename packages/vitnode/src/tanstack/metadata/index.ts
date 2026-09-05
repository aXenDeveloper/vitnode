import type { VitNodeMetadata } from "@/lib/metadata";

import { formatPageTitle } from "@/lib/metadata";

/** What a crawler may do with a page. */
export type RouteRobots = "index, follow" | "noindex, nofollow";

/** What kind of thing a page is, to a social card. */
export type RouteOpenGraphType = "article" | "website";

export interface RouteOpenGraph {
  /** The `<meta property="og:description">`. */
  description?: string;

  title?: string;
  /** `article` for a document, `website` for a landing page. */
  type?: RouteOpenGraphType;
}

export interface RouteHeadOptions {
  /** The `<meta name="description">`, when the page has one. */
  description?: string;

  openGraph?: RouteOpenGraph;

  robots?: RouteRobots;
  /** The page's own title, already translated. */
  title?: string;
}

export const routeHead = (
  metadata: VitNodeMetadata,
  { description, openGraph, robots, title }: RouteHeadOptions = {},
) => ({
  meta: [
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
  ],
});

export type RouteHeadResult = ReturnType<typeof routeHead>;

export const createRouteHead =
  (metadata: VitNodeMetadata) =>
  (options: RouteHeadOptions = {}) =>
    routeHead(metadata, options);
