import type { VitNodeMetadata } from "@/lib/metadata";

import { formatPageTitle } from "@/lib/metadata";

/** What a crawler may do with a page. */
export type RouteRobots = "index, follow" | "noindex, nofollow";

export interface RouteHeadOptions {
  /** The `<meta name="description">`, when the page has one. */
  description?: string;
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
  { description, robots, title }: RouteHeadOptions = {},
) => ({
  meta: [
    ...(robots ? [{ content: robots, name: "robots" }] : []),
    ...(title ? [{ title: formatPageTitle(metadata, title) }] : []),
    ...(description ? [{ content: description, name: "description" }] : []),
  ],
});

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
