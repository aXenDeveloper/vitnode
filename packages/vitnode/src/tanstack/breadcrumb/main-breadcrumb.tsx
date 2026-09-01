"use client";

import { useMatches, useRouter } from "@tanstack/react-router";

import { useRouteNavigationPending } from "../pending/navigation-pending";
import { BreadcrumbPendingSkeleton } from "../pending/shapes";
import { breadcrumbOf } from "./model";

/**
 * The shell's breadcrumb area: whichever matched route declared the deepest
 * crumb, and nothing at all when none did.
 *
 * `useMatches()` rather than a `select`: the whole match list changes on
 * navigation, which is exactly when this has to re-render, and the router's
 * structural sharing has nothing useful to say about a React element.
 *
 * The crumb owns its own markup, including the container the Next.js slot uses
 * (`BreadcrumbMain` renders `container mx-auto p-4`), so a route that moves here
 * keeps the spacing it had.
 *
 * Takes nothing. Every VitNode shell renders exactly this in the `breadcrumb`
 * slot of `ThemeLayoutContent`, and the only thing that varies between
 * applications is which crumbs their routes declare - which is the routes'
 * business, not this component's.
 *
 * ## Why it holds a shape rather than the destination's crumb
 *
 * A crumb is a route's `staticData`, but it is declared as an *element* so it
 * may use hooks - a translated label, or one a dynamic route reads from its
 * loader. That is exactly why the destination's cannot simply be drawn early:
 * the data it would read is the data the navigation is still fetching. So the
 * area holds a shape for as long as the content below it does, on the router's
 * own `defaultPendingMs`, and the two change together.
 *
 * Only when there is a trail to replace. A shell whose current page declares no
 * crumb shows nothing, and inventing a skeleton there would put a separator and
 * two bars into a header that has neither before the navigation nor after it.
 */
export const MainBreadcrumb = () => {
  const breadcrumb = breadcrumbOf(useMatches());
  const isNavigating = useRouteNavigationPending(
    useRouter().options.defaultPendingMs ?? 0,
  );

  if (isNavigating && breadcrumb != null) return <BreadcrumbPendingSkeleton />;

  // Wrapped rather than returned straight: `ReactNode` includes a promise in
  // React 19's types, and a component whose inferred return type includes one
  // reads as an async component to every rule that looks for one.
  return <>{breadcrumb}</>;
};
