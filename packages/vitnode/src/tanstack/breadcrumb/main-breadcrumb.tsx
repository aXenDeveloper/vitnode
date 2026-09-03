"use client";

import { useMatches, useRouter } from "@tanstack/react-router";

import { BreadcrumbTrailContent } from "@/views/breadcrumb/breadcrumb-trail-content";

import { RouterLink } from "../layout/router-link";
import { useRouteNavigationPending } from "../pending/navigation-pending";
import { BreadcrumbPendingSkeleton } from "../pending/shapes";
import { breadcrumbTrail } from "./model";

/**
 * The public site's breadcrumb area: every matched route that declared a crumb,
 * parent to child, and nothing at all when none did.
 *
 * `useMatches()` rather than a `select`: the whole match list changes on
 * navigation, which is exactly when this has to re-render, and the router's
 * structural sharing has nothing useful to say about a React element.
 *
 * The container is here rather than in each crumb, which is the point of a trail:
 * a route contributes a label, and the shell owns the spacing, the separators,
 * the navigation landmark and the locale-aware links (`RouterLink` writes the
 * locale prefix back into every href the router builds).
 *
 * Takes nothing. Every VitNode shell renders exactly this in the `breadcrumb`
 * slot of `ThemeLayoutContent`, and the only thing that varies between
 * applications is which crumbs their routes declare - which is the routes'
 * business, not this component's.
 *
 * ## Why it holds a shape rather than the destination's trail
 *
 * A crumb may read the data its route is still fetching - a product's name, a
 * translated label whose messages are in flight - so the destination's trail
 * cannot simply be drawn early. The area holds a shape for as long as the content
 * below it does, on the router's own `defaultPendingMs`, and the two change
 * together.
 *
 * Only when there is a trail to replace. A shell whose current page declares no
 * crumb shows nothing, and inventing a skeleton there would put a separator and
 * two bars into a header that has neither before the navigation nor after it.
 */
export const MainBreadcrumb = () => {
  const entries = breadcrumbTrail(useMatches());
  const isNavigating = useRouteNavigationPending(
    useRouter().options.defaultPendingMs ?? 0,
  );

  if (entries.length === 0) return null;

  return (
    <div className="container mx-auto p-4">
      {isNavigating ? (
        <BreadcrumbPendingSkeleton />
      ) : (
        <BreadcrumbTrailContent entries={entries} LinkComponent={RouterLink} />
      )}
    </div>
  );
};
