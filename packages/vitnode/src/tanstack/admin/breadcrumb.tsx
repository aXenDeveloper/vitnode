"use client";

import { useMatches, useRouter } from "@tanstack/react-router";

import type { AuthLinkComponent } from "@/views/auth/auth-link";

import { BreadcrumbAdminContent } from "@/views/admin/layouts/breadcrumb/breadcrumb-admin-content";
import { BreadcrumbTrailContent } from "@/views/breadcrumb/breadcrumb-trail-content";

import type { RouteBreadcrumbGroup } from "../breadcrumb/model";

import { breadcrumbGroup, breadcrumbTrail } from "../breadcrumb/model";
import { RouterLink } from "../layout/router-link";
import { useRouteNavigationPending } from "../pending/navigation-pending";
import { BreadcrumbPendingSkeleton } from "../pending/shapes";
import { useAdminNav } from "./nav";

/**
 * The AdminCP trail, contributed by the routes that own it.
 *
 * The same rule the public site follows and deliberately not re-implemented: a
 * route puts a crumb on `staticData.breadcrumb` and the shell renders every
 * matched route's, parent to child. Importing `../breadcrumb/model` is also what
 * loads the `StaticDataRouteOption` augmentation, so an admin route writes
 * `staticData: { breadcrumb: … }` with no import of its own.
 *
 * Most AdminCP screens are one route several segments deep - `/admin/core/users`
 * is a single route - and their crumbs are named by the *navigation* rather than
 * by the route tree, so they contribute a `breadcrumbGroup` of their own items.
 * That is what {@link AdminBreadcrumb} is, and it is the only place in VitNode
 * that needs the group shape.
 *
 * What is *not* here, in either half: a map from pathname to trail. The labels
 * come from the navigation this administrator can actually see. Nothing is a
 * registry, and nothing registers into one.
 */

/**
 * The AdminCP header's trail, or `null` when no matched route declared one.
 *
 * Exposed separately from the shell so it can tell an *absent* trail from an
 * empty one - it renders the header's separator only when there is something to
 * separate.
 *
 * ## Why it holds a shape rather than the destination's trail
 *
 * A crumb may read the data its route is still fetching - a user's name, a
 * translated label whose messages are in flight - so the destination's trail
 * cannot simply be drawn early. The area holds a shape for as long as the content
 * below it does, on the router's own `defaultPendingMs`, and the two change
 * together.
 *
 * Only when there is a trail to replace. A shell whose current page declares no
 * crumb shows nothing, and inventing a skeleton there would put a separator and
 * two bars into a header that has neither before the navigation nor after it.
 */
export const useAdminBreadcrumb = (): React.ReactNode => {
  const entries = breadcrumbTrail(useMatches());
  const isNavigating = useRouteNavigationPending(
    useRouter().options.defaultPendingMs ?? 0,
  );

  if (entries.length === 0) return null;

  if (isNavigating) return <BreadcrumbPendingSkeleton />;

  return (
    <BreadcrumbTrailContent
      entries={entries}
      LinkComponent={RouterLink}
      scrollable
    />
  );
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

/**
 * An AdminCP screen's crumbs, as the one contribution its route declares.
 *
 * A group rather than a label, because an AdminCP route is usually several
 * segments deep on its own - `/admin/core/users` is one route - and the trail is
 * named by the navigation rather than by the route tree. The items go straight
 * into the shell's list; see `breadcrumbGroup`.
 */
export const adminBreadcrumb = (
  props: Parameters<typeof AdminBreadcrumb>[0],
): RouteBreadcrumbGroup =>
  breadcrumbGroup(function AdminRouteBreadcrumb() {
    return <AdminBreadcrumb {...props} />;
  });
