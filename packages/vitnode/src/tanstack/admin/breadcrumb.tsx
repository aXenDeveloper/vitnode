"use client";

import { useMatches, useRouter } from "@tanstack/react-router";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { BreadcrumbAdminContent } from "@/views/admin/layouts/breadcrumb/breadcrumb-admin-content";

import { breadcrumbOf } from "../breadcrumb/model";
import { RouterLink } from "../layout/router-link";
import { useRouteNavigationPending } from "../pending/navigation-pending";
import { BreadcrumbPendingSkeleton } from "../pending/shapes";
import { useAdminNav } from "./nav";

/**
 * The AdminCP trail, declared by the route that owns it.
 *
 * Stage 8's rule, unchanged and deliberately not re-implemented: a route puts an
 * element on `staticData.breadcrumb`, the shell renders whichever matched route
 * declared the deepest one, `undefined` inherits and `null` clears. Importing
 * `../breadcrumb/model` is also what loads the `StaticDataRouteOption`
 * augmentation, so an admin route writes `staticData: { breadcrumb: … }` with no
 * import of its own.
 *
 * What is *not* here, in either half: a map from pathname to trail. The Next.js
 * AdminCP resolves one through `@breadcrumb` parallel routes whose folders
 * mirror the pages; this resolves it from the matched routes. Neither is a
 * registry, and nothing registers into one.
 *
 *     Next.js   @breadcrumb/core/users/page.tsx  ->  <BreadcrumbAdmin segments={["core","users"]} />
 *     TanStack  routes/_admin/core/users.tsx     ->  staticData: { breadcrumb: <AdminBreadcrumb segments={["core","users"]} /> }
 */

/**
 * Whichever matched admin route declared the deepest crumb, or `null`.
 *
 * Exposed separately from the component so the shell can tell an *absent* trail
 * from an empty one - it renders the header's separator only when there is
 * something to separate.
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
export const useAdminBreadcrumb = (): React.ReactNode => {
  const breadcrumb = breadcrumbOf(useMatches());
  const isNavigating = useRouteNavigationPending(
    useRouter().options.defaultPendingMs ?? 0,
  );

  if (isNavigating && breadcrumb != null) return <BreadcrumbPendingSkeleton />;

  return breadcrumb;
};

export const AdminBreadcrumb = ({
  labels,
  LinkComponent = RouterLink,
  overrideLastLabel,
  segments,
}: {
  /** Explicit labels by href, for a crumb the navigation cannot name. */
  labels?: Record<string, string>;
  LinkComponent?: AuthLinkComponent;
  /** The last crumb's label, when the page knows it and the navigation cannot. */
  overrideLastLabel?: string;
  /** The path below `/admin`, e.g. `["core", "users"]`. */
  segments: string[];
}) => (
  <BreadcrumbAdminContent
    labels={labels}
    LinkComponent={LinkComponent}
    /**
     * Labels come from the navigation this admin can actually see, which is the
     * same list the sidebar renders - so the trail and the menu name a screen
     * identically, in every language, and a screen they may not open cannot be
     * named at all.
     */
    nav={useAdminNav()}
    overrideLastLabel={overrideLastLabel}
    segments={segments}
  />
);
