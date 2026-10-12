import type { PluginRoute, PluginRouteSegment } from "../routing/types";
import type { ResolvedPageCacheConfig } from "./config";
import type {
  PageCachePolicy,
  PageCachePolicySource,
  PageCacheRoute,
  PageCacheSetting,
} from "./policy";

import { compareRouteSpecificity } from "../routing/match";
import {
  formatRoutePath,
  parseRoutePath,
  routeMatchKey,
} from "../routing/path";
import { PageCachePolicyError } from "./policy";

/** A page route the host application owns, already parsed. */
export interface PageCacheHostRoute {
  /** For the diagnostic: the route file. */
  file: string;
  segments: PluginRouteSegment[];
}

export interface ResolvedPageCacheRoute {
  /** What the route itself declared, before the host had its say. */
  declared: PageCacheSetting | undefined;
  /** `"app"` for a host route, the plugin id otherwise. */
  owner: string;
  path: string;
  /** The policy that applies. `null` means the route is never cached. */
  policy: null | PageCachePolicy;
  segments: PluginRouteSegment[];
  /** Who decided `policy`; `null` when nobody declared anything. */
  source: null | PageCachePolicySource;
}

export interface ResolvePageCacheRoutesInput {
  config: ResolvedPageCacheConfig;
  hostRoutes: readonly PageCacheHostRoute[];
  pluginRoutes: readonly PluginRoute[];
}

/** Paths that are never public HTML: the AdminCP and the API. */
const PRIVATE_PREFIXES = ["admin", "api"];

const isPrivatePath = (segments: readonly PluginRouteSegment[]): boolean => {
  const [first] = segments;

  return (
    first?.kind === "static" &&
    PRIVATE_PREFIXES.includes(first.value.toLowerCase())
  );
};

interface Candidate {
  declared: PageCacheSetting | undefined;
  /** Why this route may not be cached, when it may not. */
  forbidden: null | string;
  owner: string;
  path: string;
  segments: PluginRouteSegment[];
}

const pluginCandidates = (routes: readonly PluginRoute[]): Candidate[] => {
  const byId = new Map(routes.map(route => [route.id, route]));
  const requirementOf = (route: PluginRoute): null | string => {
    for (
      let current: PluginRoute | undefined = route;
      current !== undefined;
      current =
        current.parentId === null ? undefined : byId.get(current.parentId)
    ) {
      if (current.requires !== null) return current.requires;
    }

    return null;
  };

  return routes
    .filter(route => route.kind === "page")
    .map(route => {
      const requirement = requirementOf(route);
      const forbidden =
        route.area === "admin" || isPrivatePath(route.segments)
          ? "it is an AdminCP or API route, which is never public HTML"
          : requirement !== null
            ? `it requires \`${requirement}\`, so its HTML depends on who is asking`
            : null;

      return {
        declared: route.cache,
        forbidden,
        owner: route.pluginId,
        path: route.path,
        segments: route.segments,
      };
    });
};

const hostCandidates = (routes: readonly PageCacheHostRoute[]): Candidate[] =>
  [
    ...new Map(
      routes.map(route => [routeMatchKey(route.segments), route]),
    ).values(),
  ].map(route => ({
    declared: undefined,
    forbidden: isPrivatePath(route.segments)
      ? "it is an AdminCP or API route, which is never public HTML"
      : null,
    owner: "app",
    path: formatRoutePath(route.segments),
    segments: route.segments,
  }));

/**
 * Every page route with the cache policy that applies to it.
 *
 * The one place a policy is decided. The generated runtime table and the
 * `vitnode build` report are both made from this result, so what the report
 * says is what the server does.
 *
 * Uncached is the default. A route opts in with `cache`, and the host may
 * replace or remove that through `pageCache.routes` - or opt one of its own
 * routes in. A route whose HTML depends on the visitor (the AdminCP, the API,
 * anything with `requires`) refuses a policy from either side.
 */
export const resolvePageCacheRoutes = ({
  config,
  hostRoutes,
  pluginRoutes,
}: ResolvePageCacheRoutesInput): ResolvedPageCacheRoute[] => {
  const candidates = [
    ...pluginCandidates(pluginRoutes),
    ...hostCandidates(hostRoutes),
  ];
  const byKey = new Map(
    candidates.map(candidate => [routeMatchKey(candidate.segments), candidate]),
  );
  const overrides = new Map<string, PageCacheSetting>();

  for (const [path, setting] of Object.entries(config.routes)) {
    const parsed = parseRoutePath(path);
    const candidate = parsed.ok
      ? byKey.get(routeMatchKey(parsed.segments))
      : undefined;

    if (candidate === undefined) {
      throw new PageCachePolicyError(
        `\`vitNodeConfig.pageCache.routes\` names ${JSON.stringify(path)}, which is not a page route of this app. Use the canonical path a route was declared with, such as "/blog/:slug".`,
      );
    }

    overrides.set(routeMatchKey(candidate.segments), setting);
  }

  return candidates
    .map((candidate): ResolvedPageCacheRoute => {
      const override = overrides.get(routeMatchKey(candidate.segments));
      const setting = override ?? candidate.declared;
      const source: null | PageCachePolicySource =
        override !== undefined
          ? "host"
          : candidate.declared === undefined
            ? null
            : "route";

      if (setting && candidate.forbidden !== null) {
        throw new PageCachePolicyError(
          `${source === "host" ? "`vitNodeConfig.pageCache.routes`" : `"${candidate.owner}"`} gives the route "${candidate.path}" a page cache policy, but ${candidate.forbidden}. Remove the policy.`,
        );
      }

      return {
        declared: candidate.declared,
        owner: candidate.owner,
        path: candidate.path,
        policy: config.enabled && setting ? setting : null,
        segments: candidate.segments,
        source,
      };
    })
    .sort(compareRouteSpecificity);
};

/** The slice of {@link resolvePageCacheRoutes} the server needs at runtime. */
export const pageCacheRouteTable = (
  routes: readonly ResolvedPageCacheRoute[],
): PageCacheRoute[] =>
  routes.map(route =>
    route.policy === null
      ? { path: route.path }
      : { path: route.path, ...route.policy },
  );
