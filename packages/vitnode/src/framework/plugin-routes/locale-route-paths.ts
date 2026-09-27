import type { RoutePathTarget } from "../../lib/i18n/route-paths-validation.js";
import type { PluginRoute, PluginRouteSegment } from "../../routing/types.js";
import type { HostRoutePath } from "./host-routes.js";

import { localeRoutingFromConfig } from "../../lib/i18n/locale-routing.js";
import { assertRoutePathsMatchRoutes } from "../../lib/i18n/route-paths-validation.js";
import { formatRoutePath } from "../../routing/path.js";

export type LocaleRoutePathsConfig = Parameters<
  typeof localeRoutingFromConfig
>[0];

export interface LocaleRoutePathTargetsOptions {
  hostRoutes?: readonly HostRoutePath[];
  isIgnoredPath: (pathname: string) => boolean;
  manifest: readonly PluginRoute[];
}

export interface AssertLocaleRoutePathsOptions {
  hostRoutes?: readonly HostRoutePath[];
  i18n: LocaleRoutePathsConfig;
  manifest: readonly PluginRoute[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isLocaleRoutePathsConfig = (
  value: unknown,
): value is LocaleRoutePathsConfig =>
  isRecord(value) &&
  typeof value.defaultLocale === "string" &&
  Array.isArray(value.locales) &&
  value.locales.every(
    locale => isRecord(locale) && typeof locale.code === "string",
  );

export const i18nFromLoadedConfig = (
  loaded: unknown,
): LocaleRoutePathsConfig | undefined => {
  if (!isRecord(loaded) || !isRecord(loaded.vitNodeConfig)) return undefined;

  const { i18n } = loaded.vitNodeConfig;

  return isLocaleRoutePathsConfig(i18n) ? i18n : undefined;
};

const hostRouteSegments = (path: string): null | PluginRouteSegment[] => {
  const parts = path.split("/").filter(part => part.length > 0);
  const segments = parts.map((part): PluginRouteSegment => {
    if (part === "$") return { kind: "splat" };
    if (part.startsWith("$")) return { kind: "param", name: part.slice(1) };

    return { kind: "static", value: part.toLowerCase() };
  });
  const misplacedSplat = segments.some(
    (segment, index) => segment.kind === "splat" && index < segments.length - 1,
  );

  return misplacedSplat ? null : segments;
};

const pluginRouteOwner = (route: PluginRoute): string =>
  `"${route.pluginId}" ${route.kind === "layout" ? "layout" : "route"} "${route.path}"`;

export const localeRoutePathTargets = ({
  hostRoutes = [],
  isIgnoredPath,
  manifest,
}: LocaleRoutePathTargetsOptions): RoutePathTarget[] => {
  const byId = new Map(manifest.map(route => [route.id, route]));

  const pluginTargets = manifest.flatMap((route): RoutePathTarget[] => {
    if (route.area === "admin" || isIgnoredPath(route.path)) return [];

    const parent =
      route.parentId === null ? undefined : byId.get(route.parentId);

    return [
      {
        kind: route.kind,
        owner: pluginRouteOwner(route),
        parentPath: parent?.path,
        path: route.path,
        segments: route.segments,
      },
    ];
  });

  const hostTargets = hostRoutes.flatMap((hostRoute): RoutePathTarget[] => {
    const segments = hostRouteSegments(hostRoute.path);
    if (segments === null) return [];

    const path = formatRoutePath(segments);
    if (isIgnoredPath(path)) return [];

    return [
      {
        kind: "host",
        owner: `app route "${hostRoute.file}"`,
        path,
        segments,
      },
    ];
  });

  return [...pluginTargets, ...hostTargets];
};

export const assertLocaleRoutePaths = ({
  hostRoutes,
  i18n,
  manifest,
}: AssertLocaleRoutePathsOptions): void => {
  const routing = localeRoutingFromConfig(i18n);

  assertRoutePathsMatchRoutes({
    routes: localeRoutePathTargets({
      hostRoutes,
      isIgnoredPath: routing.shouldIgnoreLocalePath,
      manifest,
    }),
    translator: routing.routePaths,
  });
};
