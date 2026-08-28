import type {
  PluginRoute,
  PluginRouteDefinition,
  PluginRouteManifest,
  PluginRouteSegment,
  PluginRouteSource,
} from "./types";

import { PluginRouteError } from "./errors";
import { parseRoutePath, routeMatchKey } from "./path";
import { PLUGIN_ROUTE_AREAS, PLUGIN_ROUTE_ID_SEPARATOR } from "./types";

/**
 * A `/`-separated identifier, and nothing that could escape a string literal.
 *
 * The same rule `framework/plugin-routes` applies to an id and to an entry, for
 * a reason this layer does not share - it writes both into a generated import.
 * They are stated identically anyway: an id this layer accepts and that one
 * rejects would be a route that validates and then fails the build.
 */
const SEGMENTED =
  /^[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;

/** An entry is a package export subpath, and export maps add the extension. */
const ENTRY_EXTENSION = /\.[cm]?[jt]sx?$/;

/**
 * A route's globally unique id.
 *
 * Namespaced by the plugin so two plugins can both call their landing page
 * `"index"` - which they will - without either having to know the other exists.
 */
export const pluginRouteId = (pluginId: string, routeId: string): string =>
  `${pluginId}${PLUGIN_ROUTE_ID_SEPARATOR}${routeId}`;

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
 * The id breaks the remaining tie, and ids are unique, so the order is total.
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

export const comparePluginRoutes = (a: PluginRoute, b: PluginRoute): number => {
  const bySegments = compareSegments(a.segments, b.segments);

  if (bySegments !== 0) return bySegments;
  if (a.id === b.id) return 0;

  return a.id < b.id ? -1 : 1;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readEntry = (
  entry: string | undefined,
  pluginId: string,
  routeId: string,
): string => {
  const fail = (reason: string): never => {
    throw new PluginRouteError(
      `Plugin route "${routeId}" from ${pluginId} has an invalid entry ${JSON.stringify(entry)}: ${reason}.`,
      { code: "invalid-entry", pluginId, routeId },
    );
  };

  if (typeof entry !== "string" || !SEGMENTED.test(entry)) {
    return fail(
      'expected a package export subpath such as "routes/example-page" - "/"-separated segments of letters, digits, ".", "_" and "-", with no leading slash and no ".." segment',
    );
  }

  if (ENTRY_EXTENSION.test(entry)) {
    return fail(
      "an entry is a package export subpath and the plugin's export map adds the extension - drop it",
    );
  }

  return entry;
};

const readDefinition = (
  definition: unknown,
  pluginId: string,
  index: number,
): PluginRoute => {
  if (!isRecord(definition)) {
    throw new PluginRouteError(
      `Plugin ${pluginId} declared a route at index ${index} that is not an object.`,
      { code: "malformed-route", pluginId },
    );
  }

  // The only cast in the module. `routes` is typed, but a plugin is JavaScript
  // by the time it is registered and its config is written by hand, so the
  // fields are read defensively and the types are re-established here.
  const { area, entry, id, path } =
    definition as Partial<PluginRouteDefinition>;

  if (typeof id !== "string" || !SEGMENTED.test(id)) {
    throw new PluginRouteError(
      `Plugin ${pluginId} declared a route at index ${index} with an invalid id ${JSON.stringify(id)} - use letters, digits, ".", "-" and "_".`,
      { code: "invalid-id", pluginId },
    );
  }

  if (area !== undefined && !PLUGIN_ROUTE_AREAS.includes(area)) {
    throw new PluginRouteError(
      `Plugin route "${id}" from ${pluginId} declares the unknown area ${JSON.stringify(area)}. Known areas: ${PLUGIN_ROUTE_AREAS.join(", ")}.`,
      { code: "invalid-area", pluginId, routeId: id },
    );
  }

  if (typeof path !== "string") {
    throw new PluginRouteError(
      `Plugin route "${id}" from ${pluginId} declares no path (got ${JSON.stringify(path)}).`,
      { code: "invalid-path", pluginId, routeId: id },
    );
  }

  const parsed = parseRoutePath(path);

  if (!parsed.ok) {
    throw new PluginRouteError(
      `Plugin route "${id}" from ${pluginId} has an invalid path: ${parsed.reason}.`,
      { code: "invalid-path", path, pluginId, routeId: id },
    );
  }

  return {
    area: area ?? "main",
    entry: readEntry(entry, pluginId, id),
    id: pluginRouteId(pluginId, id),
    path: parsed.path,
    pluginId,
    routeId: id,
    segments: parsed.segments,
  };
};

/**
 * Every plugin route in an application, validated and deterministically ordered.
 *
 * Pure, and total in the only sense that matters: it either returns a manifest
 * no framework can misread, or it throws a {@link PluginRouteError} naming the
 * plugin, the route and - on a collision - both sides of it. There is no third
 * outcome where a route is quietly dropped, because a page that silently stops
 * existing is the failure mode this whole function is for.
 *
 * Registration order affects nothing but which plugin an error message calls
 * "first".
 */
export const buildPluginRouteManifest = (
  sources: PluginRouteSource[],
): PluginRouteManifest => {
  const routes: PluginRoute[] = [];
  const byId = new Map<string, PluginRoute>();
  const byPath = new Map<string, PluginRoute>();

  for (const source of sources) {
    const pluginId = isRecord(source) ? source.pluginId : undefined;

    if (typeof pluginId !== "string" || !/^\S+$/.test(pluginId)) {
      throw new PluginRouteError(
        `A plugin registered routes without a plugin id (got ${JSON.stringify(pluginId)}).`,
        { code: "invalid-plugin-id", pluginId: "" },
      );
    }

    const declared = (source.routes ?? []) as unknown[];

    if (!Array.isArray(declared)) {
      throw new PluginRouteError(
        `Plugin ${pluginId} declared \`routes\` that is not an array.`,
        { code: "malformed-route", pluginId },
      );
    }

    declared.forEach((definition, index) => {
      const route = readDefinition(definition, pluginId, index);
      const existingById = byId.get(route.id);

      if (existingById) {
        throw new PluginRouteError(
          `Duplicate plugin route id "${route.id}": declared twice by ${pluginId}.`,
          {
            code: "duplicate-id",
            conflictsWith: {
              pluginId: existingById.pluginId,
              routeId: existingById.id,
            },
            path: route.path,
            pluginId,
            routeId: route.id,
          },
        );
      }

      // Keyed on the URLs the route matches rather than on its text, so
      // `/blog/:slug` and `/blog/:postId` collide - they are one route spelled
      // twice. Area-scoped, because the same pathname under two different
      // layouts would be two different URLs; only one area exists today.
      const pathKey = `${route.area} ${routeMatchKey(route.segments)}`;
      const existingByPath = byPath.get(pathKey);

      if (existingByPath) {
        throw new PluginRouteError(
          `Plugin route path collision on "${route.path}" (${route.area}): ${existingByPath.pluginId} already owns "${existingByPath.path}" as "${existingByPath.id}", and ${pluginId} declares "${route.path}" as "${route.id}". Two plugins cannot serve the same path - rename one of them.`,
          {
            code: "duplicate-path",
            conflictsWith: {
              pluginId: existingByPath.pluginId,
              routeId: existingByPath.id,
            },
            path: route.path,
            pluginId,
            routeId: route.id,
          },
        );
      }

      byId.set(route.id, route);
      byPath.set(pathKey, route);
      routes.push(route);
    });
  }

  return routes.sort(comparePluginRoutes);
};
