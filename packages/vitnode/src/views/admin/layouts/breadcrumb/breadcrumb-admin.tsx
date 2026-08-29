import { Suspense } from "react";

import type { VitNodeConfig } from "@/vitnode.config";

import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/lib/navigation";

import type { NavAdminParent } from "../sidebar/nav/nav-model";

import { getAdminNav } from "../sidebar/nav/get-admin-nav";
import { BreadcrumbAdminContent } from "./breadcrumb-admin-content";

export interface BreadcrumbAdminProps {
  labels?: Record<string, string>;
  nav?: NavAdminParent[];
  overrideLastLabel?: string;
  segments: string[];
  vitNodeConfig?: VitNodeConfig;
}

/**
 * {@link BreadcrumbAdminContent}, wired to Next.js.
 *
 * Resolves the navigation on the server - the labels come from it, and it is
 * already filtered by the signed-in admin's permissions - and supplies
 * `next-intl`'s locale-aware `Link`. Rendered by the `@breadcrumb` parallel
 * route whose folder matches the page.
 */
const BreadcrumbAdminResolved = async ({
  segments,
  vitNodeConfig,
  overrideLastLabel,
  labels,
  nav,
}: BreadcrumbAdminProps) => (
  <BreadcrumbAdminContent
    labels={labels}
    LinkComponent={Link}
    nav={nav ?? (await getAdminNav({ vitNodeConfig }))}
    overrideLastLabel={overrideLastLabel}
    segments={segments}
  />
);

export const BreadcrumbAdmin = (props: BreadcrumbAdminProps) => (
  <Suspense fallback={<Skeleton className="h-4 w-40" />}>
    <BreadcrumbAdminResolved {...props} />
  </Suspense>
);
