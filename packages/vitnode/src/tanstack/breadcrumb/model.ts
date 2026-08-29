/**
 * Where a breadcrumb comes from, in a router that has no parallel routes.
 *
 * Next.js resolves the main breadcrumb through a `@breadcrumb` slot: a parallel
 * route whose folder mirrors the page's, so the *deepest* folder with a
 * `page.tsx` wins, one that returns `null` clears what a shallower one rendered,
 * and everything unmatched falls through to `default.tsx`. This is the same
 * rule, expressed with what a router already has - the list of matched routes,
 * deepest last - and one optional field on each route's `staticData`.
 *
 * A `ReactNode`, exactly like the Next.js slot and like the `breadcrumb` prop of
 * `ThemeLayoutContent`, so the shell renders it rather than deciding anything
 * about it. Declaring it as an *element* is what lets a crumb use hooks - the
 * label is translated, and on a dynamic route it comes from the loader - without
 * the shell having to instantiate a component it was handed:
 *
 *     staticData: { breadcrumb: <SearchBreadcrumb /> }
 *
 * What this is *not*: a breadcrumb registry. There is no map from pathname to
 * label anywhere, and no plugin registers into one. A route declares its own
 * crumb next to its own component, and the shell renders whichever declared
 * crumb is deepest. See `MainBreadcrumb`, which is the half that renders.
 *
 * ## The augmentation, and where it has to be loaded
 *
 * `declare module` merges into the router's own types the moment this module is
 * part of the program - which it is as soon as anything imports the namespace,
 * because `MainBreadcrumb` lives next to it and every shell renders one. A route
 * file therefore writes `staticData: { breadcrumb: … }` with no import of its
 * own, exactly as it did when this rule lived in the application.
 */
declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    /**
     * What this route contributes to the shell's breadcrumb area.
     *
     * Absent means "whatever my parent said"; `null` means "nothing", which is
     * how a child clears a crumb an ancestor declared.
     *
     * Optional, and it must stay optional: a required member here would make
     * `staticData` required on every route in the app.
     */
    breadcrumb?: React.ReactNode;
  }
}

/**
 * The narrowest shape of a route match this rule reads.
 *
 * A structural type rather than the router's `AnyRouteMatch`, so the rule is a
 * function over plain data and can be tested as one - no router, no route tree.
 */
export interface BreadcrumbMatch {
  staticData: { breadcrumb?: React.ReactNode };
}

/**
 * The deepest matched route that declares a breadcrumb, or nothing.
 *
 * Deepest wins, which is the whole rule: `/settings/security` shows the security
 * crumb rather than the settings one, and a route that declares nothing inherits
 * its parent's - including inheriting *nothing*, which is how `/` ends up
 * without a breadcrumb having never mentioned one.
 *
 * `undefined` is "did not declare" and is the only value that falls through;
 * `null` is a declaration, and the deliberate way to clear an ancestor's crumb.
 */
export const breadcrumbOf = (
  matches: readonly BreadcrumbMatch[],
): React.ReactNode => {
  for (let index = matches.length - 1; index >= 0; index--) {
    const declared = matches[index].staticData.breadcrumb;

    if (declared !== undefined) return declared;
  }

  return null;
};
