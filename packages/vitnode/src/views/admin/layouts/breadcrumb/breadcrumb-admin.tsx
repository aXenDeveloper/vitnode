import { Suspense } from "react";

import type { VitNodeConfig } from "@/vitnode.config";

import { Skeleton } from "@/components/ui/skeleton";
import { BreadcrumbRender } from "@/views/breadcrumb/breadcrumb-render";

import type { NavAdminParent } from "../sidebar/nav/get-admin-nav";

import { getAdminNav } from "../sidebar/nav/get-admin-nav";
import { resolveBreadcrumb } from "./resolve-breadcrumb";

export interface BreadcrumbAdminProps {
  labels?: Record<string, string>;
  nav?: NavAdminParent[];
  overrideLastLabel?: string;
  segments: string[];
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
        crumb.isLink = !crumb.isCurrent;
      }
    }
  }

  if (overrideLastLabel && crumbs.length > 0) {
    crumbs[crumbs.length - 1].label = overrideLastLabel;
  }

  return <BreadcrumbRender crumbs={crumbs} scrollable />;
};

export const BreadcrumbAdmin = (props: BreadcrumbAdminProps) => (
  <Suspense fallback={<Skeleton className="h-4 w-40" />}>
    <BreadcrumbAdminResolved {...props} />
  </Suspense>
);
