import type { LocaleRouting } from "@/lib/i18n/locale-routing";
import type { PluginRoute, PluginRouteSegment } from "@/routing/types";

import { localeRoutingFromConfig } from "@/lib/i18n/locale-routing";
import { formatRoutePath } from "@/routing/path";

import type { HostRoutePath, LocaleRoutePathsConfig } from "../plugin-routes";

import { hostRouteSegments } from "../plugin-routes";

export type RouteRenderMode = "dynamic" | "partial" | "static";

export interface RouteReportEntry {
  mode: RouteRenderMode;
  path: string;
  staticPaths: string[];
}

export interface RouteReportInput {
  hostRoutes: readonly HostRoutePath[];
  htmlPaths: readonly string[];
  i18n: LocaleRoutePathsConfig;
  pluginRoutes: readonly PluginRoute[];
}

interface ReportedRoute {
  path: string;
  segments: PluginRouteSegment[];
  staticPaths: Set<string>;
}

const segmentRank = (segment: PluginRouteSegment | undefined): number => {
  if (segment === undefined) return 2;

  return { param: 1, splat: 3, static: 0 }[segment.kind];
};

const bySpecificity = (a: ReportedRoute, b: ReportedRoute): number => {
  const length = Math.max(a.segments.length, b.segments.length);

  for (let index = 0; index < length; index++) {
    const difference =
      segmentRank(a.segments[index]) - segmentRank(b.segments[index]);
    if (difference !== 0) return difference;
  }

  return 0;
};

const matchesRoute = (
  segments: readonly PluginRouteSegment[],
  parts: readonly string[],
): boolean => {
  for (const [index, segment] of segments.entries()) {
    if (segment.kind === "splat") return parts.length >= index;
    if (index >= parts.length) return false;
    if (
      segment.kind === "static" &&
      segment.value.toLowerCase() !== parts[index].toLowerCase()
    ) {
      return false;
    }
  }

  return segments.length === parts.length;
};

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

export const buildRouteReport = ({
  hostRoutes,
  htmlPaths,
  i18n,
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
      matchesRoute(candidate.segments, parts),
    );

    if (route === undefined) unclaimed.push(htmlPath);
    else route.staticPaths.add(htmlPath);
  }

  const entries: RouteReportEntry[] = [
    ...routes.map(route => ({
      mode: modeOf(route, localeRouting),
      path: route.path,
      staticPaths: [...route.staticPaths].sort(byPageThenLocale(localeRouting)),
    })),
    ...unclaimed.map(path => ({
      mode: "static" as const,
      path,
      staticPaths: [path],
    })),
  ];

  return entries.sort((a, b) => (a.path < b.path ? -1 : 1));
};
