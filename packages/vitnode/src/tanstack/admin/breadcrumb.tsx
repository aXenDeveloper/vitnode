"use client";

import { useMatches } from "@tanstack/react-router";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { BreadcrumbAdminContent } from "@/views/admin/layouts/breadcrumb/breadcrumb-admin-content";

import { breadcrumbOf } from "../breadcrumb/model";
import { RouterLink } from "../layout/router-link";
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
 */
export const useAdminBreadcrumb = (): React.ReactNode =>
  breadcrumbOf(useMatches());

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
