import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "@/lib/navigation";

import type { BreadcrumbCrumb } from "./crumb";

/**
 * Shared presentational renderer for a resolved list of breadcrumb crumbs.
 * Used by both the AdminCP and the main-site breadcrumbs.
 */
export const BreadcrumbRender = ({ crumbs }: { crumbs: BreadcrumbCrumb[] }) => {
  if (crumbs.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => (
          <Fragment key={crumb.href}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem>
              {crumb.isCurrent ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : crumb.isLink ? (
                <BreadcrumbLink
                  render={<Link href={crumb.href}>{crumb.label}</Link>}
                />
              ) : (
                <span>{crumb.label}</span>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
