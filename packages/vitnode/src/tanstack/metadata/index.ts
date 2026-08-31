import type { VitNodeMetadata } from "@/lib/metadata";

import { formatPageTitle } from "@/lib/metadata";

/** What a crawler may do with a page. */
export type RouteRobots = "index, follow" | "noindex, nofollow";

/** What kind of thing a page is, to a social card. */
export type RouteOpenGraphType = "article" | "website";

/**
 * The Open Graph a page declares, and the whole of it.
 *
 * Three fields, because three are what the Next.js routes this migration
 * replaces actually set. No image, no canonical URL, no Twitter card and no site
 * name: each of those is a decision with its own design - an OG image needs a
 * renderer and a cache - and inventing one here would be a new SEO system rather
 * than the metadata a page asked for.
 *
 * ## Nothing here is inherited from {@link RouteHeadOptions}
 *
 * An omitted field emits no tag. It would be easy to default `title` to the
 * page's title and `description` to its description, and it would be wrong in a
 * quiet way: `og:title` is *not* the document title - see below - so a default
 * would silently publish the wrong string to every site that unfurls a link.
 * Stating them is one line at the call site and no ambiguity anywhere.
 */
export interface RouteOpenGraph {
  /** The `<meta property="og:description">`. */
  description?: string;
  /**
   * The `<meta property="og:title">`, emitted **verbatim**.
   *
   * Deliberately not run through `formatPageTitle`, and this is the one rule on
   * this page worth reading twice. The Next.js documentation routes produced
   *
   *     <title>Routes - Plugins - VitNode</title>
   *     <meta property="og:title" content="Routes - Plugins">
   *
   * because Next applies `title.template` to the document title and leaves
   * `openGraph.title` alone. A card that read "Routes - Plugins - VitNode" over
   * a link to vitnode.com would be saying the site's name twice.
   */
  title?: string;
  /** `article` for a document, `website` for a landing page. */
  type?: RouteOpenGraphType;
}

export interface RouteHeadOptions {
  /** The `<meta name="description">`, when the page has one. */
  description?: string;
  /**
   * What a link to this page unfurls as. See {@link RouteOpenGraph}; omitted
   * entirely, the page emits no Open Graph at all, which is what every route but
   * the documentation does today.
   */
  openGraph?: RouteOpenGraph;
  /**
   * Stated rather than assumed: TanStack Start emits no robots directive of its
   * own, and every Next.js route this migration replaces sets one explicitly.
   * Omitted where a parent route already declares it - Router merges the `head`
   * of every matched route and dedupes `meta` by `name`, preferring the deepest,
   * so a child inherits by saying nothing.
   */
  robots?: RouteRobots;
  /** The page's own title, already translated. */
  title?: string;
}

/**
 * One route's `head`, in the shape every VitNode page wants.
 *
 * Written once here because it was written six times in `apps/web/src/routes`,
 * identically apart from the robots value - and the part worth centralising is
 * not the array literal but the two rules inside it.
 *
 * **The title goes through `formatPageTitle`**, which is the same
 * `"<page> - <site>"` rule Next.js applies through `title.template`. A route that
 * built its own would produce a title that disagreed with the Next.js half of
 * the same site.
 *
 * **Everything is optional, because `loaderData` is.** A route's `head` runs
 * before its loader has resolved on the very first pass, so `loaderData` is
 * `undefined` there and spreading it is how a route passes what it has:
 *
 *     head: ({ loaderData }) => pageHead({ robots: "index, follow", ...loaderData })
 *
 * Spreading `undefined` is a no-op, so that one line covers both passes and no
 * route needs a conditional. Extra keys a loader returns - a params object, a
 * user id - are ignored rather than rejected, which is what lets a loader return
 * one object for both its component and its head.
 */
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

/**
 * What a route's `head` returns - the shape {@link routeHead} produces.
 *
 * Named so that code which *takes* a bound `pageHead` can say so without
 * restating the array literal. `@vitnode/core/tanstack/plugin-routes` is the one
 * that needs it: a plugin route's metadata goes through the host's own binding,
 * because the site's name is the one thing a package cannot know.
 */
export type RouteHeadResult = ReturnType<typeof routeHead>;

/**
 * {@link routeHead}, bound to one app's metadata.
 *
 * The app's name is the one thing a package cannot know, and binding it once in
 * the host means a route file names only what is actually route-specific. It is
 * a plain closure rather than a registered singleton on purpose: `head` is
 * evaluated during render, the binding is a two-line module, and there is no
 * ordering question to get wrong.
 */
export const createRouteHead =
  (metadata: VitNodeMetadata) =>
  (options: RouteHeadOptions = {}) =>
    routeHead(metadata, options);
