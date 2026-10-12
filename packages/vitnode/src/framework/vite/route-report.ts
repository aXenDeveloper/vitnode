import type { LocaleRouting } from "@/lib/i18n/locale-routing";
import type {
  PageCachePolicy,
  PageCachePolicySource,
} from "@/page-cache/policy";
import type { ResolvedPageCacheRoute } from "@/page-cache/resolve";
import type { PluginRoute, PluginRouteSegment } from "@/routing/types";

import { localeRoutingFromConfig } from "@/lib/i18n/locale-routing";
import { compareRouteSpecificity, routeSegmentsMatch } from "@/routing/match";
import { formatRoutePath, routeMatchKey } from "@/routing/path";

import type { HostRoutePath, LocaleRoutePathsConfig } from "../plugin-routes";

import { hostRouteSegments } from "../plugin-routes";

export type RouteRenderMode = "dynamic" | "partial" | "static";

/** A page's effective HTML cache policy, and who chose it. */
export interface RouteReportCache {
  policy: null | PageCachePolicy;
  /** `"host"` when `vitNodeConfig.pageCache` overrode or disabled it. */
  source: PageCachePolicySource;
}

export interface RouteReportEntry {
  /** `null` when nothing declared a policy for this route. */
  cache: null | RouteReportCache;
  /**
   * The URL patterns other locales and domains serve this route under, for a
   * cached route - the cache keys on those, not on the canonical path.
   */
  localizedPaths: string[];
  mode: RouteRenderMode;
  path: string;
  staticPaths: string[];
}

export interface RouteReportInput {
  hostRoutes: readonly HostRoutePath[];
  htmlPaths: readonly string[];
  i18n: LocaleRoutePathsConfig;
  pageCacheRoutes?: readonly ResolvedPageCacheRoute[];
  pluginRoutes: readonly PluginRoute[];
}

interface ReportedRoute {
  path: string;
  segments: PluginRouteSegment[];
  staticPaths: Set<string>;
}

const bySpecificity = (a: ReportedRoute, b: ReportedRoute): number =>
  compareRouteSpecificity(a, b);

const reportedRoutes = (
  hostRoutes: readonly HostRoutePath[],
  pluginRoutes: readonly PluginRoute[],
): ReportedRoute[] => {
  const routes = new Map<string, ReportedRoute>();
  const add = (segments: PluginRouteSegment[]) => {
    const path = formatRoutePath(segments);
    routes.set(path, { path, segments, staticPaths: new Set() });
  };

  pluginRoutes
    .filter(route => route.kind === "page")
    .forEach(route => {
      add(route.segments);
    });
  hostRoutes.forEach(route => {
    const segments = hostRouteSegments(route.path);
    if (segments !== null) add(segments);
  });

  return [...routes.values()].sort(bySpecificity);
};

const modeOf = (
  route: ReportedRoute,
  localeRouting: LocaleRouting,
): RouteRenderMode => {
  if (route.staticPaths.size === 0) return "dynamic";
  if (route.segments.some(segment => segment.kind !== "static")) {
    return "partial";
  }

  const isEveryLocaleStatic = localeRouting.locales.every(locale =>
    route.staticPaths.has(localeRouting.localizePathname(route.path, locale)),
  );

  return isEveryLocaleStatic ? "static" : "partial";
};

const byPageThenLocale =
  (localeRouting: LocaleRouting) =>
  (a: string, b: string): number => {
    const pageA = localeRouting.deLocalizePathname(a);
    const pageB = localeRouting.deLocalizePathname(b);
    if (pageA !== pageB) return pageA < pageB ? -1 : 1;

    const localeIndex = (path: string) =>
      localeRouting.locales.indexOf(
        localeRouting.extractLocaleFromPath(path) ??
          localeRouting.defaultLocale,
      );

    return localeIndex(a) - localeIndex(b);
  };

const PATTERN_BASE = "https://vitnode.invalid";

/** Every public spelling of a route pattern other than the canonical one. */
const localizedPatterns = (
  path: string,
  localeRouting: LocaleRouting,
): string[] => {
  const variants =
    localeRouting.domains.length > 0
      ? localeRouting.domains.flatMap(domain =>
          domain.locales.map(locale => {
            const url = localeRouting.localizeUrl(
              new URL(path, domain.origin),
              locale,
              { host: domain.host },
            );

            return `${url.host}${decodeURI(url.pathname)}`;
          }),
        )
      : localeRouting.locales.map(locale =>
          decodeURI(
            localeRouting.localizeUrl(new URL(path, PATTERN_BASE), locale, {})
              .pathname,
          ),
        );

  return [...new Set(variants)].filter(variant => variant !== path);
};

const cacheOf = (
  route: ReportedRoute,
  pageCacheRoutes: readonly ResolvedPageCacheRoute[],
): null | RouteReportCache => {
  const key = routeMatchKey(route.segments);
  const resolved = pageCacheRoutes.find(
    candidate => routeMatchKey(candidate.segments) === key,
  );

  return resolved?.source == null
    ? null
    : { policy: resolved.policy, source: resolved.source };
};

export const buildRouteReport = ({
  hostRoutes,
  htmlPaths,
  i18n,
  pageCacheRoutes = [],
  pluginRoutes,
}: RouteReportInput): RouteReportEntry[] => {
  const localeRouting = localeRoutingFromConfig(i18n);
  const routes = reportedRoutes(hostRoutes, pluginRoutes);
  const unclaimed: string[] = [];

  for (const htmlPath of htmlPaths) {
    const parts = localeRouting
      .deLocalizePathname(htmlPath)
      .split("/")
      .filter(part => part.length > 0);
    const route = routes.find(candidate =>
      routeSegmentsMatch(candidate.segments, parts),
    );

    if (route === undefined) unclaimed.push(htmlPath);
    else route.staticPaths.add(htmlPath);
  }

  const entries: RouteReportEntry[] = [
    ...routes.map(route => {
      const cache = cacheOf(route, pageCacheRoutes);

      return {
        cache,
        localizedPaths:
          cache?.policy == null
            ? []
            : localizedPatterns(route.path, localeRouting),
        mode: modeOf(route, localeRouting),
        path: route.path,
        staticPaths: [...route.staticPaths].sort(
          byPageThenLocale(localeRouting),
        ),
      };
    }),
    ...unclaimed.map(path => ({
      cache: null,
      localizedPaths: [],
      mode: "static" as const,
      path,
      staticPaths: [path],
    })),
  ];

  return entries.sort((a, b) => (a.path < b.path ? -1 : 1));
};
