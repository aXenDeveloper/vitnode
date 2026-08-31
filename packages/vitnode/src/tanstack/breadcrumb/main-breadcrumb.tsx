"use client";

import { useMatches } from "@tanstack/react-router";

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
 */
export const MainBreadcrumb = () => {
  const breadcrumb = breadcrumbOf(useMatches());

  // Wrapped rather than returned straight: `ReactNode` includes a promise in
  // React 19's types, and a component whose inferred return type includes one
  // reads as an async component to every rule that looks for one.
  return <>{breadcrumb}</>;
};
