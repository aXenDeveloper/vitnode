import type { PluginRoute, PluginRouteSegment } from "./types";

/**
 * The order routes are declared in must not decide which one wins.
 *
 * Compared segment by segment: a static segment sorts before a parameter at the
 * same depth, so `/blog/new` precedes `/blog/:slug` no matter who registered
 * first; equal kinds compare by their text, and a shorter path precedes a longer
 * one that starts the same way. Comparison is by code unit rather than
 * `localeCompare`, because a route table that reorders itself on a machine with
 * a different locale is a bug that only reproduces on someone else's laptop.
 *
 * Its own module because two things sort with it - the manifest builder and the
 * graph, which sorts a layout's children - and having the graph reach into the
 * manifest for it would make the two import each other.
 */
const compareSegments = (
  a: PluginRouteSegment[],
  b: PluginRouteSegment[],
): number => {
  const shared = Math.min(a.length, b.length);

  for (let index = 0; index < shared; index += 1) {
    const left = a[index];
    const right = b[index];

    if (left.kind !== right.kind) {
      return left.kind === "static" ? -1 : 1;
    }

    const leftText = left.kind === "static" ? left.value : left.name;
    const rightText = right.kind === "static" ? right.value : right.name;

    if (leftText !== rightText) {
      return leftText < rightText ? -1 : 1;
    }
  }

  return a.length - b.length;
};

/**
 * Two routes, in a total order that depends on the routes alone.
 *
 * The id breaks the remaining tie - which is what a layout and its index route
 * come down to, their paths being equal - and ids are unique, so the order is
 * total.
 */
export const comparePluginRoutes = (a: PluginRoute, b: PluginRoute): number => {
  const bySegments = compareSegments(a.segments, b.segments);

  if (bySegments !== 0) return bySegments;
  if (a.id === b.id) return 0;

  return a.id < b.id ? -1 : 1;
};
