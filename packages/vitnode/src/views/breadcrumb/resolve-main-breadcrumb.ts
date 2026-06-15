import type { BreadcrumbCrumb } from "./crumb";

import { humanize } from "./crumb";

/**
 * Turns the path segments after `/` into breadcrumb crumbs for the public site.
 * Unlike the AdminCP nav-based resolver, every non-current segment links to its
 * own path, and labels come from the optional `labels` map (cumulative href →
 * translated label) with a humanized fallback.
 */
export const resolveMainBreadcrumb = (
  segments: string[],
  labels: Record<string, string> = {},
): BreadcrumbCrumb[] =>
  segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const isCurrent = index === segments.length - 1;
    const known = labels[href];

    return {
      href,
      isCurrent,
      isKnown: known !== undefined,
      isLink: !isCurrent,
      label: known ?? humanize(segment),
    };
  });
