import type { PluginRoute, PluginRouteSegment } from "./types";

import { PluginRouteError } from "./errors";
import { normalizeNamespaceList } from "./namespaces";
import { comparePluginRoutes } from "./order";
import { formatRoutePath, relativeRouteSegments, routeMatchKey } from "./path";

export interface PluginRouteNode {
  /** In manifest order: static before dynamic, shallow before deep. */
  children: PluginRouteNode[];
  /** How many parents are above this route. A root is `0`. */
  depth: number;

  isIndex: boolean;
  parent: null | PluginRouteNode;

  relativePath: string;
  /** {@link PluginRouteNode.relativePath}, parsed. Empty for an index route. */
  relativeSegments: PluginRouteSegment[];
  route: PluginRoute;
}

/** A manifest, as the tree it describes. */
export interface PluginRouteGraph {
  byId: ReadonlyMap<string, PluginRouteNode>;

  nodes: PluginRouteNode[];
  /** The routes with no parent, in manifest order. */
  roots: PluginRouteNode[];
}

const fail = (
  code: PluginRouteError["code"],
  route: PluginRoute,
  message: string,
  conflictsWith?: PluginRoute,
): never => {
  throw new PluginRouteError(message, {
    code,
    conflictsWith: conflictsWith && {
      pluginId: conflictsWith.pluginId,
      routeId: conflictsWith.id,
    },
    path: route.path,
    pluginId: route.pluginId,
    routeId: route.id,
  });
};

export const buildPluginRouteGraph = (
  manifest: readonly PluginRoute[],
): PluginRouteGraph => {
  const byId = new Map<string, PluginRouteNode>();

  for (const route of manifest) {
    const existing = byId.get(route.id);

    if (existing) {
      fail(
        "duplicate-id",
        route,
        `Duplicate plugin route id "${route.id}" in the route manifest.`,
        existing.route,
      );
    }

    byId.set(route.id, {
      children: [],
      depth: 0,
      isIndex: false,
      parent: null,
      relativePath: route.path,
      relativeSegments: [...route.segments],
      route,
    });
  }

  const roots: PluginRouteNode[] = [];

  // Pass one: who hangs from whom. Nothing about paths yet - a cycle has to be
  // ruled out before anything walks the tree, and "not inside its parent" is a
  // confusing thing to say about two routes that are each other's parent.
  for (const node of byId.values()) {
    const { route } = node;
    const { parentId } = route;

    if (parentId === null) {
      roots.push(node);
      continue;
    }

    if (parentId === route.id) {
      fail(
        "parent-cycle",
        route,
        `Plugin route "${route.id}" is its own parent.`,
      );
    }

    const parent = byId.get(parentId);

    if (!parent) {
      fail(
        "unknown-parent",
        route,
        `Plugin route "${route.id}" declares the parent "${parentId}", which no route in the manifest has. A parent is the layout this route was nested inside in its plugin's own route tree.`,
      );

      continue;
    }

    if (parent.route.pluginId !== route.pluginId) {
      fail(
        "cross-plugin-parent",
        route,
        `Plugin route "${route.id}" declares the parent "${parentId}", which belongs to ${parent.route.pluginId}. A route may only be nested inside a layout from its own plugin.`,
        parent.route,
      );
    }

    if (parent.route.kind !== "layout") {
      fail(
        "invalid-parent-kind",
        route,
        `Plugin route "${route.id}" declares the parent "${parentId}", which is a ${parent.route.kind} rather than a layout. Only a layout can have routes inside it.`,
        parent.route,
      );
    }

    // A subtree renders in one shell, because nesting *is* how a shell is
    // chosen: a nested route is mounted under its layout, and its layout is
    // mounted under its area's shell. So a child's declared area is never
    // consulted again once it has a parent - which means a mismatch here is not
    // a route in two shells, it is a route whose `area` says one thing and does
    // another. Silently, and in the direction that matters most: a page marked
    // `admin` under a `main` layout would render on the public site, outside the
    // AdminCP session guard, wearing the site header.
    //
    // Refused rather than inherited. Filling the field in from the parent would
    // make two manifests that read differently behave identically, and the one
    // that reads wrong is the one somebody will review.
    if (parent.route.area !== route.area) {
      fail(
        "cross-area-parent",
        route,
        `Plugin route "${route.id}" is in the "${route.area}" area but declares the parent "${parentId}", which is in "${parent.route.area}". A nested route renders in the shell its layout renders in, so the two have to agree - change one of them.`,
        parent.route,
      );
    }

    node.parent = parent;
    parent.children.push(node);
  }

  // Pass two: depth, ordering and the requirement rule, walking down from the
  // roots. A node this never reaches has a parent and no chain of parents that
  // ends at one, which is exactly what a cycle is - and because the walk starts
  // only from roots, it cannot enter the cycle to loop in it.
  const reached = new Set<PluginRouteNode>();

  const walk = (
    node: PluginRouteNode,
    depth: number,
    inheritedFrom: null | PluginRouteNode,
  ): void => {
    node.depth = depth;
    reached.add(node);

    const declared = node.route.requires;
    const inherited = inheritedFrom?.route.requires ?? null;

    if (inherited !== null && declared !== null && declared !== inherited) {
      fail(
        "conflicting-requires",
        node.route,
        `Plugin route "${node.route.id}" requires "${declared}" but sits inside "${inheritedFrom?.route.id}", which requires "${inherited}". No visitor could ever reach it.`,
        inheritedFrom?.route,
      );
    }

    // The *effective* requirement, passed down and never written back onto the
    // route: a manifest says what its plugin declared, and what a nested route
    // inherits is this graph's reading of it. A node that declares nothing
    // forwards its ancestor's, which is what makes a neutral layout transparent
    // rather than a reset.
    const source = declared === null ? inheritedFrom : node;

    node.children.sort((a, b) => comparePluginRoutes(a.route, b.route));

    for (const child of node.children) walk(child, depth + 1, source);
  };

  roots.sort((a, b) => comparePluginRoutes(a.route, b.route));

  for (const root of roots) walk(root, 0, null);

  for (const node of byId.values()) {
    if (reached.has(node)) continue;

    fail(
      "parent-cycle",
      node.route,
      `Plugin route "${node.route.id}" is in a parent cycle - following its parents never reaches a route without one.`,
    );
  }

  // Pass three: what each child adds to its parent's path, which is also where
  // a child that is not inside its parent at all is refused.
  for (const node of byId.values()) {
    const { parent, route } = node;

    if (parent === null) continue;

    const relative = relativeRouteSegments(
      parent.route.segments,
      route.segments,
    );

    if (relative === null) {
      fail(
        "invalid-parent-path",
        route,
        `Plugin route "${route.id}" claims "${route.path}", which is not inside its parent "${parent.route.path}". A nested route declares its full path, and that path has to start with its layout's - including the parameter names.`,
        parent.route,
      );

      continue;
    }

    if (relative.length === 0 && route.kind === "layout") {
      fail(
        "invalid-parent-path",
        route,
        `Plugin route "${route.id}" is a layout at "${route.path}", which is exactly its parent "${parent.route.path}". A nested layout has to add at least one path segment - a layout that adds none would be a pathless group, which VitNode plugin routes do not represent.`,
        parent.route,
      );
    }

    node.isIndex = relative.length === 0;
    node.relativeSegments = relative;
    node.relativePath = formatRoutePath(relative);
  }

  for (const node of byId.values()) {
    if (node.route.kind === "layout" && node.children.length === 0) {
      fail(
        "childless-layout",
        node.route,
        `Plugin route "${node.route.id}" is a layout with no routes inside it. A layout claims no URL of its own, so nothing would ever render it - give it an \`index()\` route, or make it a \`page()\`.`,
      );
    }
  }

  // Pass four: two routes that answer the same URLs.
  //
  // `buildPluginRouteManifest` already refuses two routes of the *same* kind at
  // one path, which is where a plugin's own duplicate and the ordinary
  // plugin-versus-plugin clash are caught. What it cannot decide is the
  // cross-kind case, because exactly one spelling of it is legal and telling
  // them apart needs the tree rather than the list: a layout claims no URL, so
  // it shares its path with its own index child and with nothing else.
  //
  // Anything else that shares a match key is two routes competing for one URL.
  // Left here, it reached the router - which refuses it too, but as
  // `Invariant failed: Duplicate routes found with id: /_plugins/foo`, naming
  // neither plugin and pointing at an internal container. Two plugins cannot be
  // asked to work that out between them.
  //
  // In this pass rather than in the manifest builder so it also holds for a
  // manifest nobody built here - the generated file is a literal, and the
  // runtime rebuilds the graph from it with this same function.
  //
  // Keyed on the URL alone, with no `area` in it, for the reason the manifest
  // builder states: every shell a host mounts these under is *pathless*, so an
  // area chooses the frame around a page and never the URL it answers. A layout
  // in the AdminCP and a page on the public site that spell one pathname are two
  // routes competing for one URL, and only the router's ranking would separate
  // them.
  const byMatchKey = new Map<string, PluginRouteNode[]>();

  for (const node of byId.values()) {
    const key = routeMatchKey(node.route.segments);

    byMatchKey.set(key, [...(byMatchKey.get(key) ?? []), node]);
  }

  for (const group of byMatchKey.values()) {
    if (group.length < 2) continue;

    // Sorted so the pair a diagnostic names is the same one on every machine,
    // and so the route reported as the newcomer is the later of the two.
    const claimants = [...group].sort((a, b) =>
      comparePluginRoutes(a.route, b.route),
    );
    const layout = claimants.find(node => node.route.kind === "layout");
    // A layout may be joined by its own index child, and by nothing else - which
    // also settles the cross-plugin question, since a child's parent is always
    // from its own plugin.
    const legal =
      claimants.length === 2 &&
      layout !== undefined &&
      claimants.some(node => node.isIndex && node.parent === layout);

    if (legal) continue;

    const [first, second] = claimants;

    fail(
      "duplicate-path",
      second.route,
      `Plugin route path collision on "${second.route.path}" (${second.route.area}): ${first.route.pluginId} already owns "${first.route.path}" as a ${first.route.kind} ("${first.route.id}", ${first.route.area}), and ${second.route.pluginId} declares it as a ${second.route.kind} ("${second.route.id}"). Both match the same URLs - a shell is pathless, so an area frames a page rather than moving it - and VitNode will not let a router's ordering decide which one answers. Rename one of them. Only a layout and the index page inside it may share a path.`,
      first.route,
    );
  }

  // Depth-first from the sorted roots, which is what puts a parent in front of
  // every one of its children without a second sort.
  const nodes: PluginRouteNode[] = [];
  const collect = (node: PluginRouteNode): void => {
    nodes.push(node);
    node.children.forEach(collect);
  };

  roots.forEach(collect);

  return { byId, nodes, roots };
};

export const pluginRouteNamespaces = (node: PluginRouteNode): string[] => {
  const namespaces: string[] = [];

  for (
    let current: null | PluginRouteNode = node;
    current !== null;
    current = current.parent
  ) {
    namespaces.push(...current.route.messages);
  }

  return normalizeNamespaceList(namespaces);
};
