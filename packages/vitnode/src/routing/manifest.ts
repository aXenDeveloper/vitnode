import type {
  PluginRoute,
  PluginRouteDefinition,
  PluginRouteManifest,
  PluginRouteSource,
} from "./types";

import { PluginRouteError } from "./errors";
import { buildPluginRouteGraph } from "./graph";
import { namespaceProblem, normalizeNamespaceList } from "./namespaces";
import { comparePluginRoutes } from "./order";
import { parseRoutePath, routeMatchKey } from "./path";
import {
  PLUGIN_ROUTE_AREAS,
  PLUGIN_ROUTE_ID_SEPARATOR,
  PLUGIN_ROUTE_KINDS,
  PLUGIN_ROUTE_REQUIREMENTS,
} from "./types";

export { comparePluginRoutes };

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

/**
 * A declared `parentId`, as the global id the built route carries.
 *
 * The namespacing is the enforcement: a plugin writes its own local id and this
 * puts its own plugin's name in front of it, so there is no spelling of this
 * field that reaches another plugin's route. Cross-plugin nesting is not
 * forbidden by a check here - it is unrepresentable.
 */
const readParentId = (
  parentId: unknown,
  pluginId: string,
  routeId: string,
): null | string => {
  if (parentId === undefined || parentId === null) return null;

  if (typeof parentId !== "string" || !SEGMENTED.test(parentId)) {
    throw new PluginRouteError(
      `Plugin route "${routeId}" from ${pluginId} declares an invalid parentId ${JSON.stringify(parentId)}. A parentId is another route's own \`id\` from the same plugin - not a path, and not a "<plugin>:<route>" pair.`,
      { code: "invalid-parent", pluginId, routeId },
    );
  }

  return pluginRouteId(pluginId, parentId);
};

const readNamespaces = (
  namespaces: unknown,
  pluginId: string,
  routeId: string,
): string[] => {
  if (namespaces === undefined) return [];

  if (!Array.isArray(namespaces)) {
    throw new PluginRouteError(
      `Plugin route "${routeId}" from ${pluginId} declares \`namespaces\` that is not an array.`,
      { code: "invalid-namespace", pluginId, routeId },
    );
  }

  // `Array.from` rather than `map`: `map` skips holes in a sparse array, so an
  // entry could reach normalisation without ever being checked.
  const checked = Array.from(namespaces, (value: unknown, index) => {
    const problem = namespaceProblem(value);

    if (problem) {
      throw new PluginRouteError(
        `Plugin route "${routeId}" from ${pluginId} declares namespaces[${index}] that ${problem}`,
        { code: "invalid-namespace", pluginId, routeId },
      );
    }

    return value as string;
  });

  return normalizeNamespaceList(checked);
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
  const { area, entry, id, kind, namespaces, parentId, path, requires } =
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

  if (kind !== undefined && !PLUGIN_ROUTE_KINDS.includes(kind)) {
    throw new PluginRouteError(
      `Plugin route "${id}" from ${pluginId} declares the unknown kind ${JSON.stringify(kind)}. Known kinds: ${PLUGIN_ROUTE_KINDS.join(", ")}.`,
      { code: "invalid-kind", pluginId, routeId: id },
    );
  }

  if (
    requires !== undefined &&
    requires !== null &&
    !PLUGIN_ROUTE_REQUIREMENTS.includes(requires)
  ) {
    throw new PluginRouteError(
      `Plugin route "${id}" from ${pluginId} declares the unknown requirement ${JSON.stringify(requires)}. Known requirements: ${PLUGIN_ROUTE_REQUIREMENTS.join(", ")}.`,
      { code: "invalid-requires", pluginId, routeId: id },
    );
  }

  // `requires` is about the public session; the AdminCP runs on a second one
  // under its own cookie. An `admin` route already sits behind the shell's own
  // guard, so `requires: "authenticated"` here is at best a restatement of
  // something composition already provides - and `requires: "guest"` is a page
  // no human being could reach, since the two guards would turn away everybody
  // between them.
  //
  // Refused rather than ignored, because the field would read as enforcement
  // while enforcing a different session's answer. The thing an author actually
  // wants - "only staff with this permission" - is not this field in either
  // area: it gates a page's *content*, through the same components the AdminCP's
  // own screens use, and the API refuses the data regardless.
  if (
    requires !== undefined &&
    requires !== null &&
    (area ?? "main") === "admin"
  ) {
    throw new PluginRouteError(
      `Plugin route "${id}" from ${pluginId} is in the "admin" area and declares \`requires: ${JSON.stringify(requires)}\`. \`requires\` is about the public session, and the AdminCP has its own - a route in the admin area is already behind the AdminCP's session guard, so drop the field. To gate the page on a staff permission, gate its content inside the route module instead.`,
      { code: "requires-in-admin-area", pluginId, routeId: id },
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
    kind: kind ?? "page",
    namespaces: readNamespaces(namespaces, pluginId, id),
    parentId: readParentId(parentId, pluginId, id),
    path: parsed.path,
    pluginId,
    requires: requires ?? null,
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
 * Two kinds of check, in two places, because they answer different questions.
 * Here: is each route legal on its own, and does any two of them claim one URL.
 * In `buildPluginRouteGraph`, which this calls last: does the hierarchy they
 * describe hold together. Keeping the second in the graph is what lets the
 * runtime re-derive the tree from the generated manifest with the same function
 * that validated it.
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
      // twice. Area-scoped, because the same pathname in two different shells
      // is two different URLs: an `admin` route's path is `/admin/…` and a
      // `main` one's is not, so text they happen to share is not a clash. Two
      // routes compete only when they answer one URL in one shell.
      //
      // Scoped by kind as well, and that is what nesting costs. A layout claims
      // no URL, so a layout at `/settings` and the index page inside it both
      // spell `/settings` and are not a collision - they are the two halves of
      // one screen. Two *pages* there still are one, and so are two layouts,
      // which would be two frames competing for one subtree.
      const pathKey = `${route.kind} ${route.area} ${routeMatchKey(route.segments)}`;
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

  const manifest = routes.sort(comparePluginRoutes);

  // Last, and for its exceptions rather than for its result: a manifest whose
  // hierarchy does not hold together is not a manifest, and the build has to
  // stop here rather than in a browser. The tree itself is rebuilt from this
  // list by whatever mounts it, with this same function.
  buildPluginRouteGraph(manifest);

  return manifest;
};
