import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/lib/navigation";
import { cn } from "@/lib/utils";

import type { BreadcrumbCrumb } from "./crumb";

export const BreadcrumbRender = ({
  crumbs,
  scrollable,
}: {
  crumbs: BreadcrumbCrumb[];
  /**
   * Keeps every crumb on a single line and scrolls them horizontally instead
   * of wrapping - for fixed-height bars like the AdminCP header.
   */
  scrollable?: boolean;
}) => {
  if (crumbs.length === 0) return null;

  return (
    <Breadcrumb
      className={cn(
        scrollable &&
          "no-scrollbar scroll-fade-x overflow-x-auto overscroll-x-contain",
      )}
    >
      <BreadcrumbList
        className={cn(scrollable && "flex-nowrap whitespace-nowrap")}
      >
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

/**
 * Placeholder trail for a breadcrumb that resolves its labels from the URL.
 *
 * Built from the same list and separators as {@link BreadcrumbRender} so the
 * crumbs land on the row they will occupy once they arrive, rather than moving
 * the header's contents when the boundary resolves.
 */
export const BreadcrumbSkeleton = ({ crumbs = 2 }: { crumbs?: number }) => (
  <Breadcrumb>
    <BreadcrumbList className="flex-nowrap whitespace-nowrap">
      {Array.from({ length: crumbs }, (_, index) => (
        <Fragment key={`skeleton-crumb-${index}`}>
          {index > 0 && <BreadcrumbSeparator />}
          <BreadcrumbItem>
            <Skeleton className="h-4 w-20" />
          </BreadcrumbItem>
        </Fragment>
      ))}
    </BreadcrumbList>
  </Breadcrumb>
);
