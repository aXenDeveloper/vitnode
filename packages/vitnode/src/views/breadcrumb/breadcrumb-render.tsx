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
