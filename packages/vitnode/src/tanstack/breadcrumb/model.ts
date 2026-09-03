import { createElement } from "react";

/**
 * Where a breadcrumb comes from, in a router that has no parallel routes.
 *
 * Next.js resolved the main breadcrumb through a `@breadcrumb` slot: a parallel
 * route whose folder mirrored the page's, so the *deepest* folder with a
 * `page.tsx` rendered the whole trail. This is the same idea taken one step
 * further and expressed with what a router already has - the list of matched
 * routes, deepest last - and one optional field on each route's `staticData`.
 *
 * ## A trail, not a winner
 *
 * Every matched route that declares a crumb contributes **one item** to the
 * trail, in parent-to-child order:
 *
 *     Home / Catalog / Products / Laptops / MacBook Pro
 *
 * So a route says what it is called and nothing else. It does not restate its
 * layouts' crumbs, it does not know how deep it is, and it never builds a link:
 * the shell owns the separators, the `nav`/`aria-current` semantics and the
 * locale-aware href, which it takes from the matched route's own pathname.
 *
 * A route that declares nothing contributes nothing, and its parents' crumbs
 * stay visible - which is what a page inside a layout that already names the
 * screen wants. `false` says the same thing on purpose.
 *
 * ## Three shapes, and why the third exists
 *
 * A crumb is usually a **component**, because a label is translated and so has
 * to be able to call a hook, and because the shell hands it the match's own
 * loader data, params and search - which an element written next to the route
 * options could not be given. An **element** is the simpler spelling for a label
 * that needs nothing.
 *
 * {@link breadcrumbGroup} is the third, and it is for one situation: a single
 * route whose URL is several crumbs deep, where the labels come from somewhere
 * other than the route tree. The AdminCP is exactly that - `/admin/core/users`
 * is one route, and its trail is named by the navigation this administrator can
 * see - so its crumbs are rendered by one of VitNode's own components, which
 * emits its own items inside the shell's list. Plugins never need it: their
 * contract is a label.
 */
declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /**
     * What this route contributes to the shell's breadcrumb trail.
     *
     * Absent or `false` contributes nothing, which leaves whatever this route's
     * parents declared.
     *
     * Optional, and it must stay optional: a required member here would make
     * `staticData` required on every route in the app.
     */
    breadcrumb?: RouteBreadcrumb;
  }
}

/**
 * What a route's breadcrumb component is handed - the match that declared it.
 *
 * Its own match rather than the deepest one, so a layout's crumb reads the
 * layout's own loader data while a page inside it is what the visitor is looking
 * at. Everything is widened to `unknown` because a package cannot name a host's
 * route types; a crumb that needs its data narrows it, or - for a plugin route -
 * is handed the typed `PluginRouteBreadcrumbProps` instead.
 */
export interface RouteBreadcrumbProps {
  loaderData: unknown;
  params: Readonly<Record<string, string>>;
  /** This match's own URL, as the router's internal pathname. */
  pathname: string;
  search: unknown;
}

/**
 * Several crumbs from one matched route, rendered by a VitNode component.
 *
 * The escape hatch the AdminCP needs, and nothing else uses: the component emits
 * `<BreadcrumbItem>`s of its own inside the shell's list, with its own
 * separators between them, so a route whose URL is three segments deep can be
 * named by three crumbs. The shell still owns the separator *before* the group
 * and the wrapper around the whole trail.
 */
export interface RouteBreadcrumbGroup {
  group: React.ComponentType<RouteBreadcrumbProps>;
}

export type RouteBreadcrumb =
  | false
  | React.ComponentType<RouteBreadcrumbProps>
  | React.ReactNode
  | RouteBreadcrumbGroup;

/** Declares that one route contributes {@link RouteBreadcrumbGroup} crumbs. */
export const breadcrumbGroup = (
  group: React.ComponentType<RouteBreadcrumbProps>,
): RouteBreadcrumbGroup => ({ group });

/**
 * The narrowest shape of a route match this rule reads.
 *
 * A structural type rather than the router's `AnyRouteMatch`, so the rule is a
 * function over plain data and can be tested as one - no router, no route tree.
 */
export interface BreadcrumbMatch {
  loaderData?: unknown;
  params?: unknown;
  pathname?: string;
  routeId?: string;
  search?: unknown;
  staticData: { breadcrumb?: RouteBreadcrumb };
}

/** One item of the rendered trail. */
export interface BreadcrumbTrailEntry {
  /** The label, ready to render - or the items themselves, for a group. */
  content: React.ReactNode;
  /** Where this crumb points, taken from the matched route's own pathname. */
  href: string;
  isCurrent: boolean;
  key: string;
  /** The content renders its own `<BreadcrumbItem>`s. See {@link breadcrumbGroup}. */
  spansItems: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isGroup = (value: unknown): value is RouteBreadcrumbGroup =>
  isRecord(value) && typeof value.group === "function";

const propsFor = (match: BreadcrumbMatch): RouteBreadcrumbProps => ({
  loaderData: match.loaderData,
  params: isRecord(match.params)
    ? (match.params as Readonly<Record<string, string>>)
    : {},
  pathname: match.pathname ?? "",
  search: match.search,
});

/**
 * Every matched route that declares a crumb, parent to child.
 *
 * `undefined`, `null` and `false` all contribute nothing; the difference between
 * them is only what an author meant, and `false` is the spelling that says it.
 * The last entry is the current page, which is what the shell renders as
 * `aria-current` rather than as a link.
 */
export const breadcrumbTrail = (
  matches: readonly BreadcrumbMatch[],
): BreadcrumbTrailEntry[] => {
  const entries = matches.flatMap((match, position) => {
    const declared = match.staticData.breadcrumb;

    if (declared === undefined || declared === null || declared === false) {
      return [];
    }

    const key = match.routeId ?? `match-${String(position)}`;
    const href = match.pathname ?? "";

    if (isGroup(declared)) {
      return [
        {
          content: createElement(declared.group, propsFor(match)),
          href,
          isCurrent: false,
          key,
          spansItems: true,
        },
      ];
    }

    if (typeof declared === "function") {
      return [
        {
          content: createElement(
            declared as React.ComponentType<RouteBreadcrumbProps>,
            propsFor(match),
          ),
          href,
          isCurrent: false,
          key,
          spansItems: false,
        },
      ];
    }

    return [
      {
        content: declared,
        href,
        isCurrent: false,
        key,
        spansItems: false,
      },
    ];
  });

  const last = entries.at(-1);

  if (last) last.isCurrent = true;

  return entries;
};
