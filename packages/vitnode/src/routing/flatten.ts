import type { PluginRouteDeclaration, PluginRouteLazyComponent } from "./tree";
import type {
  PluginRouteArea,
  PluginRouteKind,
  PluginRouteRequirement,
  PluginRouteSearchValidator,
  PluginRouteSegment,
} from "./types";

import { PluginRouteError } from "./errors";
import { namespaceProblem, normalizeNamespaceList } from "./namespaces";
import { parseRoutePath } from "./path";
import { isPluginRouteDeclaration, isPluginRouteLazyComponent } from "./tree";
import { PLUGIN_ROUTE_AREAS, PLUGIN_ROUTE_REQUIREMENTS } from "./types";

export interface FlatPluginRoute {
  area: PluginRouteArea;
  component: PluginRouteLazyComponent;
  kind: PluginRouteKind;
  messages: string[];
  parentId: null | string;
  path: string;
  requires: null | PluginRouteRequirement;
  routeId: string;
  search: null | PluginRouteSearchValidator;
  segments: PluginRouteSegment[];
}

export const pluginRouteIdFor = (kind: PluginRouteKind, path: string): string =>
  `${kind}#${path}`;

const LAZY_EXAMPLE = 'lazy(() => import("./pages/my-page"))';

const fail = ({
  code,
  message,
  path,
  pluginId,
}: {
  code: PluginRouteError["code"];
  message: string;
  path?: string;
  pluginId: string;
}): never => {
  throw new PluginRouteError(message, { code, path, pluginId });
};

const readMessages = (
  messages: unknown,
  pluginId: string,
  where: string,
): string[] => {
  if (messages === undefined) return [];

  if (!Array.isArray(messages)) {
    return fail({
      code: "invalid-namespace",
      message: `${where} in ${pluginId} declares \`messages\` that is not an array.`,
      pluginId,
    });
  }

  const checked = Array.from(messages, (value: unknown, position) => {
    const problem = namespaceProblem(value);

    if (problem) {
      return fail({
        code: "invalid-namespace",
        message: `${where} in ${pluginId} declares messages[${String(position)}] that ${problem}`,
        pluginId,
      });
    }

    return value as string;
  });

  return normalizeNamespaceList(checked);
};

const readRequires = (
  requires: unknown,
  area: PluginRouteArea,
  pluginId: string,
  where: string,
): null | PluginRouteRequirement => {
  if (requires === undefined || requires === null) return null;

  if (!PLUGIN_ROUTE_REQUIREMENTS.includes(requires as PluginRouteRequirement)) {
    return fail({
      code: "invalid-requires",
      message: `${where} in ${pluginId} declares the unknown requirement ${JSON.stringify(requires)}. Known requirements: ${PLUGIN_ROUTE_REQUIREMENTS.join(", ")}.`,
      pluginId,
    });
  }

  if (area === "admin") {
    return fail({
      code: "requires-in-admin-area",
      message: `${where} in ${pluginId} is in the "admin" area and declares \`requires: ${JSON.stringify(requires)}\`. \`requires\` is about the public session and the AdminCP has its own, so an admin route is already behind the AdminCP's session guard - drop the field. To gate the page on a staff permission, gate its content inside the route module.`,
      pluginId,
    });
  }

  return requires as PluginRouteRequirement;
};

const readArea = (
  area: unknown,
  pluginId: string,
  where: string,
): PluginRouteArea => {
  if (area === undefined) return "main";

  if (!PLUGIN_ROUTE_AREAS.includes(area as PluginRouteArea)) {
    return fail({
      code: "invalid-area",
      message: `${where} in ${pluginId} declares the unknown area ${JSON.stringify(area)}. Known areas: ${PLUGIN_ROUTE_AREAS.join(", ")}.`,
      pluginId,
    });
  }

  return area as PluginRouteArea;
};

const readComponent = (
  component: unknown,
  pluginId: string,
  where: string,
): PluginRouteLazyComponent => {
  if (isPluginRouteLazyComponent(component)) return component;

  const eager =
    typeof component === "function"
      ? " A component imported into routes.ts is part of the initial bundle, so its page can never be split into a chunk of its own."
      : "";

  return fail({
    code: "eager-component",
    message: `${where} in ${pluginId} declares a \`component\` that is not \`${LAZY_EXAMPLE}\`.${eager} Write \`component: ${LAZY_EXAMPLE}\` - the import stays a literal Vite can follow, and nothing runs it until the route is matched or preloaded.`,
    pluginId,
  });
};

const readSearch = (
  search: unknown,
  kind: PluginRouteKind,
  pluginId: string,
  where: string,
): null | PluginRouteSearchValidator => {
  if (search === undefined || search === null) return null;

  if (kind === "layout") {
    return fail({
      code: "invalid-search",
      message: `${where} in ${pluginId} is a layout and declares \`search\`. A layout claims no URL of its own, so it has no query string to validate - declare it on the page that reads the search.`,
      pluginId,
    });
  }

  if (typeof search !== "function") {
    return fail({
      code: "invalid-search",
      message: `${where} in ${pluginId} declares a \`search\` that is not a function. \`search\` reads this route's query string and is called by the router while it matches the URL.`,
      pluginId,
    });
  }

  return search as PluginRouteSearchValidator;
};

const readPath = ({
  declared,
  isIndex,
  parent,
  pluginId,
  where,
}: {
  declared: null | string;
  isIndex: boolean;
  parent: FlatPluginRoute | null;
  pluginId: string;
  where: string;
}): string => {
  if (isIndex) {
    if (parent === null) {
      return fail({
        code: "invalid-tree",
        message: `${where} in ${pluginId} is an index route at the top level. An index route renders at its parent layout's own URL, so it belongs in a layout's \`children\`.`,
        pluginId,
      });
    }

    return parent.path;
  }

  if (typeof declared !== "string" || declared.trim() === "") {
    return fail({
      code: "invalid-path",
      message: `${where} in ${pluginId} declares no path (got ${JSON.stringify(declared)}). Use \`index({ ... })\` for the route that renders at its parent layout's own URL.`,
      pluginId,
    });
  }

  if (parent === null) {
    if (!declared.startsWith("/")) {
      return fail({
        code: "invalid-path",
        message: `${where} in ${pluginId} declares the path ${JSON.stringify(declared)}. A top-level route's path is absolute - write ${JSON.stringify(`/${declared}`)}.`,
        pluginId,
      });
    }

    return declared;
  }

  if (declared.startsWith("/")) {
    return fail({
      code: "invalid-path",
      message: `${where} in ${pluginId} declares the path ${JSON.stringify(declared)} inside the layout at "${parent.path}". A nested route's path is relative to its parent - write ${JSON.stringify(declared.slice(1))} and VitNode joins the two.`,
      pluginId,
    });
  }

  return parent.path === "/" ? `/${declared}` : `${parent.path}/${declared}`;
};

const describe = (
  declared: PluginRouteDeclaration,
  parent: FlatPluginRoute | null,
): string => {
  const shape = declared.isIndex ? "index route" : declared.kind;

  return parent === null
    ? `A top-level ${shape}`
    : `A ${shape} inside the layout at "${parent.path}"`;
};

const readNode = ({
  declared,
  flat,
  parent,
  pluginId,
}: {
  declared: unknown;
  flat: FlatPluginRoute[];
  parent: FlatPluginRoute | null;
  pluginId: string;
}): void => {
  if (!isPluginRouteDeclaration(declared)) {
    return fail({
      code: "invalid-tree",
      message: `${pluginId} declares a route${parent === null ? "" : ` inside the layout at "${parent.path}"`} that was not built with page(), layout() or index(). Every route in a \`definePluginRoutes\` tree comes from one of those - a plain object cannot say which kind of route it is.`,
      pluginId,
    });
  }

  const where = describe(declared, parent);
  const area =
    parent === null ? readArea(declared.area, pluginId, where) : parent.area;

  if (parent !== null && declared.area !== undefined) {
    return fail({
      code: "invalid-area",
      message: `${where} in ${pluginId} declares an \`area\`. Only a top-level route chooses its shell - every route inside a layout renders in the shell its layout renders in, so remove the field.`,
      pluginId,
    });
  }

  const path = readPath({
    declared: declared.path,
    isIndex: declared.isIndex,
    parent,
    pluginId,
    where,
  });
  const parsed = parseRoutePath(path);

  if (!parsed.ok) {
    return fail({
      code: "invalid-path",
      message: `${where} in ${pluginId} has an invalid path: ${parsed.reason}.`,
      path,
      pluginId,
    });
  }

  const children = declared.children ?? [];

  if (declared.kind === "layout" && children.length === 0) {
    return fail({
      code: "childless-layout",
      message: `${where} in ${pluginId} is a layout with no \`children\`. A layout claims no URL of its own, so nothing would ever render it - give it an \`index()\` route, or make it a \`page()\`.`,
      path: parsed.path,
      pluginId,
    });
  }

  const route: FlatPluginRoute = {
    area,
    component: readComponent(declared.component, pluginId, where),
    kind: declared.kind,
    messages: readMessages(declared.messages, pluginId, where),
    parentId: parent === null ? null : parent.routeId,
    path: parsed.path,
    requires: readRequires(declared.requires, area, pluginId, where),
    routeId: pluginRouteIdFor(declared.kind, parsed.path),
    search: readSearch(declared.search, declared.kind, pluginId, where),
    segments: parsed.segments,
  };

  flat.push(route);

  for (const child of children) {
    readNode({ declared: child, flat, parent: route, pluginId });
  }
};

export const flattenPluginRoutes = (
  pluginId: string,
  routes: unknown,
): FlatPluginRoute[] => {
  if (routes === undefined || routes === null) return [];

  if (!Array.isArray(routes)) {
    return fail({
      code: "malformed-route",
      message: `Plugin ${pluginId} declared \`routes\` that is not an array. A plugin's \`routes.ts\` exports \`definePluginRoutes([...])\`.`,
      pluginId,
    });
  }

  const flat: FlatPluginRoute[] = [];

  for (const declared of routes) {
    readNode({ declared, flat, parent: null, pluginId });
  }

  return flat;
};
