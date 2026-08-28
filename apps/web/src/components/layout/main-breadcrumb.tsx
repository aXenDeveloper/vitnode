import { useMatches } from '@tanstack/react-router'

import { breadcrumbOf } from '#/lib/breadcrumb'

/**
 * The shell's breadcrumb area: whichever matched route declared the deepest
 * crumb, and nothing at all when none did.
 *
 * `useMatches()` rather than a `select`: the whole match list changes on
 * navigation, which is exactly when this has to re-render, and the router's
 * structural sharing has nothing useful to say about a React element.
 *
 * The crumb owns its own markup, including the container the legacy slot uses
 * (`BreadcrumbMain` renders `container mx-auto p-4`), so a route that moves here
 * keeps the spacing it had.
 */
export const MainBreadcrumb = () => {
  const breadcrumb = breadcrumbOf(useMatches())

  // Wrapped rather than returned straight: `ReactNode` includes a promise in
  // React 19's types, and a component whose inferred return type includes one
  // reads as an async component to every rule that looks for one.
  return <>{breadcrumb}</>
}
