import { createElement, useSyncExternalStore } from "react";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    breadcrumb?: RouteBreadcrumb;
  }
}

export interface RouteBreadcrumbProps {
  loaderData: unknown;
  params: Readonly<Record<string, string>>;
  /** This match's own URL, as the router's internal pathname. */
  pathname: string;
  search: unknown;
}

export interface RouteBreadcrumbGroup {
  group: React.ComponentType<RouteBreadcrumbProps>;
}

export type RouteBreadcrumbDeclaration =
  | false
  | React.ComponentType<RouteBreadcrumbProps>
  | React.ReactNode
  | RouteBreadcrumbGroup;

export interface RouteBreadcrumbDeferred {
  resolve: () => RouteBreadcrumbDeclaration | undefined;
  subscribe: (listener: () => void) => () => void;
}

export type RouteBreadcrumb =
  RouteBreadcrumbDeclaration | RouteBreadcrumbDeferred;

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
