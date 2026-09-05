import { createElement } from "react";

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

export type RouteBreadcrumb =
  | false
  | React.ComponentType<RouteBreadcrumbProps>
  | React.ReactNode
  | RouteBreadcrumbGroup;

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
