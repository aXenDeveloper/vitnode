import type { PageCachePolicy, PageCacheRouteTable } from "./policy";

import {
  compareRouteSpecificity,
  pathnameParts,
  routeSegmentsMatch,
} from "../routing/match";
import { parseRoutePath } from "../routing/path";

export interface PageCacheRouteMatch {
  path: string;
  policy: null | PageCachePolicy;
}

/**
 * Finds the route an internal pathname belongs to, the way the router would,
 * and answers with its policy.
 *
 * Every page route is in the table - cached or not - so a more specific
 * uncached route (`/blog/new`) is never answered by a cached pattern next to it
 * (`/blog/:slug`).
 */
export const createPageCacheMatcher = (table: PageCacheRouteTable) => {
  const routes = table
    .flatMap(route => {
      const parsed = parseRoutePath(route.path);
      if (!parsed.ok) return [];

      return [
        {
          path: route.path,
          policy:
            route.maxAge === undefined
              ? null
              : route.staleWhileRevalidate === undefined
                ? { maxAge: route.maxAge }
                : {
                    maxAge: route.maxAge,
                    staleWhileRevalidate: route.staleWhileRevalidate,
                  },
          segments: parsed.segments,
        },
      ];
    })
    .sort(compareRouteSpecificity);

  return (internalPathname: string): null | PageCacheRouteMatch => {
    let parts: string[];
    try {
      parts = pathnameParts(internalPathname).map(part =>
        decodeURIComponent(part),
      );
    } catch {
      return null;
    }

    const route = routes.find(candidate =>
      routeSegmentsMatch(candidate.segments, parts),
    );

    return route === undefined
      ? null
      : { path: route.path, policy: route.policy };
  };
};
