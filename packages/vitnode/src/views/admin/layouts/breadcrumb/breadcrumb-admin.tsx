import { Suspense } from "react";

import type { VitNodeConfig } from "@/vitnode.config";

import { Skeleton } from "@/components/ui/skeleton";
import { BreadcrumbRender } from "@/views/breadcrumb/breadcrumb-render";

import type { NavAdminParent } from "../sidebar/nav/get-admin-nav";

import { getAdminNav } from "../sidebar/nav/get-admin-nav";
import { resolveBreadcrumb } from "./resolve-breadcrumb";

export interface BreadcrumbAdminProps {
  /**
   * Overrides crumb labels by their full path (e.g. `/admin/blog/posts/123`),
   * at any position. Use this for a server-resolved name that isn't the last
   * segment; a labelled crumb also becomes a link (unless it's the current page).
   */
  labels?: Record<string, string>;
  /** Pre-built nav to reuse; rebuilt from `vitNodeConfig` when omitted. */
  nav?: NavAdminParent[];
  /** Shortcut to override the label of the last (current) crumb. */
  overrideLastLabel?: string;
  /** Path segments after `/admin`, e.g. `["core", "users", "roles"]`. */
  segments: string[];
  /** Defaults to the registered app config when omitted. */
  vitNodeConfig?: VitNodeConfig;
}

const BreadcrumbAdminResolved = async ({
  segments,
  vitNodeConfig,
  overrideLastLabel,
  labels,
  nav,
}: BreadcrumbAdminProps) => {
  const crumbs = resolveBreadcrumb(
    nav ?? (await getAdminNav({ vitNodeConfig })),
    segments,
  );

  if (labels) {
    for (const crumb of crumbs) {
      const label = labels[crumb.href];
      if (label !== undefined) {
        crumb.label = label;
        // An explicit label means a real, navigable page - link it.
        crumb.isLink = !crumb.isCurrent;
      }
    }
  }

  if (overrideLastLabel && crumbs.length > 0) {
    crumbs[crumbs.length - 1].label = overrideLastLabel;
  }

  return <BreadcrumbRender crumbs={crumbs} scrollable />;
};

/**
 * The nav the crumbs are resolved from is permission-filtered, so building it
 * reads the admin session. That read is kept behind this boundary rather than
 * one in the layout: `@breadcrumb` is its own route segment, and a boundary
 * above the segment does not make a navigation into it instant.
 */
export const BreadcrumbAdmin = (props: BreadcrumbAdminProps) => (
  <Suspense fallback={<Skeleton className="h-4 w-40" />}>
    <BreadcrumbAdminResolved {...props} />
  </Suspense>
);
