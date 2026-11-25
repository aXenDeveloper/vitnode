import { BreadcrumbCrumbItems } from "@/views/breadcrumb/breadcrumb-render-content";

import type { NavAdminParent } from "../sidebar/nav/nav-model";

import { appendPageCrumb, resolveBreadcrumb } from "./resolve-breadcrumb";

export interface BreadcrumbAdminContentProps {
  /** Explicit labels by href, for a crumb the navigation cannot name. */
  labels?: Record<string, string>;
  nav: NavAdminParent[];
  /** The last crumb's label, when the page knows it and the navigation cannot. */
  overrideLastLabel?: string;
  pageCrumb?: boolean;
  /** The path below `/admin`, e.g. `["core", "users"]`. */
  segments: string[];
}

export const BreadcrumbAdminContent = ({
  labels,
  nav,
  overrideLastLabel,
  pageCrumb,
  segments,
}: BreadcrumbAdminContentProps) => {
  const resolved = resolveBreadcrumb(nav, segments);
  const crumbs = pageCrumb ? appendPageCrumb(nav, resolved) : resolved;

  if (crumbs.length === 0) return null;

  if (labels) {
    for (const crumb of crumbs) {
      const label = labels[crumb.href];
      if (label !== undefined) {
        crumb.label = label;
        crumb.isLink = !crumb.isCurrent;
      }
    }
  }

  if (overrideLastLabel) {
    crumbs[crumbs.length - 1].label = overrideLastLabel;
  }

  return <BreadcrumbCrumbItems crumbs={crumbs} />;
};
