import { createElement, useSyncExternalStore } from "react";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    breadcrumb?: RouteBreadcrumb;
  }
}

/** What a breadcrumb component receives: its route match's data. */
export interface RouteBreadcrumbProps {
  loaderData: unknown;
  params: Readonly<Record<string, string>>;
  /** This match's own URL, as the router's internal pathname. */
  pathname: string;
  search: unknown;
}

/** A crumb component that renders several `<BreadcrumbItem>`s itself. Create it with {@link breadcrumbGroup}. */
export interface RouteBreadcrumbGroup {
  group: React.ComponentType<RouteBreadcrumbProps>;
}

/**
 * What a route declares as `staticData.breadcrumb`: a node (`<span>Docs</span>`),
 * a component reading the match (`({ loaderData }) => ...`), a group, or `false`
 * for no crumb.
 */
export type RouteBreadcrumbDeclaration =
  | false
  | React.ComponentType<RouteBreadcrumbProps>
  | React.ReactNode
  | RouteBreadcrumbGroup;

/** A crumb only known later (e.g. registered by a lazily loaded module). Create it with {@link breadcrumbDeferred}. */
export interface RouteBreadcrumbDeferred {
  resolve: () => RouteBreadcrumbDeclaration | undefined;
  subscribe: (listener: () => void) => () => void;
}

/**
 * A route's breadcrumb, set as `staticData.breadcrumb` in its route options.
 * Each matched route that declares one contributes a crumb linking to its own
 * URL; the last one is the current page. A crumb that renders strings needs
 * its own `RouteMessages`.
 *
 * @example
 * ```tsx
 * // src/site/solutions/breadcrumb.tsx
 * export const SolutionsBreadcrumb = () => (
 *   <RouteMessages>
 *     <span>Solutions</span>
 *   </RouteMessages>
 * );
 *
 * // src/routes/_main/solutions/index.tsx
 * export const Route = createFileRoute("/_main/solutions/")({
 *   staticData: { breadcrumb: <SolutionsBreadcrumb /> },
 *   component: SolutionsIndexPage,
 * });
 * ```
 */
export type RouteBreadcrumb =
  | RouteBreadcrumbDeclaration
  | RouteBreadcrumbDeferred;

/**
 * Declares a crumb resolved later. The trail re-renders when `subscribe`
 * reports that `resolve` started (or stopped) returning a crumb - not when an
 * already resolved crumb changes.
 */
export const breadcrumbDeferred = (
  resolve: RouteBreadcrumbDeferred["resolve"],
  subscribe: RouteBreadcrumbDeferred["subscribe"],
): RouteBreadcrumbDeferred => ({ resolve, subscribe });

/** Declares that one route contributes {@link RouteBreadcrumbGroup} crumbs. */
export const breadcrumbGroup = (
  group: React.ComponentType<RouteBreadcrumbProps>,
): RouteBreadcrumbGroup => ({ group });

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

const isDeferred = (value: unknown): value is RouteBreadcrumbDeferred =>
  isRecord(value) && typeof value.resolve === "function";

const declarationOf = (
  breadcrumb: RouteBreadcrumb | undefined,
): RouteBreadcrumbDeclaration | undefined =>
  isDeferred(breadcrumb) ? breadcrumb.resolve() : breadcrumb;

const propsFor = (match: BreadcrumbMatch): RouteBreadcrumbProps => ({
  loaderData: match.loaderData,
  params: isRecord(match.params)
    ? (match.params as Readonly<Record<string, string>>)
    : {},
  pathname: match.pathname ?? "",
  search: match.search,
});

/** The trail for a list of route matches, outermost first - the pure half of {@link useBreadcrumbTrail}. */
export const breadcrumbTrail = (
  matches: readonly BreadcrumbMatch[],
): BreadcrumbTrailEntry[] => {
  const entries = matches.flatMap((match, position) => {
    const declared = declarationOf(match.staticData.breadcrumb);

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

const deferredCrumbs = (
  matches: readonly BreadcrumbMatch[],
): RouteBreadcrumbDeferred[] =>
  matches.flatMap(match =>
    isDeferred(match.staticData.breadcrumb)
      ? [match.staticData.breadcrumb]
      : [],
  );

const resolutionOf = (deferred: readonly RouteBreadcrumbDeferred[]): string =>
  deferred.map(entry => (entry.resolve() === undefined ? "-" : "+")).join("");

/** The breadcrumb trail of the current matches, kept in sync with deferred crumbs. */
export const useBreadcrumbTrail = (
  matches: readonly BreadcrumbMatch[],
): BreadcrumbTrailEntry[] => {
  const deferred = deferredCrumbs(matches);
  const subscribe = (listener: () => void) => {
    const unsubscribes = deferred.map(entry => entry.subscribe(listener));

    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  };
  const resolution = () => resolutionOf(deferred);

  useSyncExternalStore(subscribe, resolution, resolution);

  return breadcrumbTrail(matches);
};
