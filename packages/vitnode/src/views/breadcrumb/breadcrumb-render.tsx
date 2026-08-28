import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/lib/navigation";

import type { BreadcrumbCrumb } from "./crumb";

import { BreadcrumbRenderContent } from "./breadcrumb-render-content";

/**
 * {@link BreadcrumbRenderContent}, wired to Next.js.
 *
 * Where `next-intl`'s locale-aware `Link` enters a breadcrumb, and the only
 * place it does - the AdminCP trail and the public one both render through here.
 */
export const BreadcrumbRender = ({
  crumbs,
  scrollable,
}: {
  crumbs: BreadcrumbCrumb[];
  scrollable?: boolean;
}) => (
  <BreadcrumbRenderContent
    crumbs={crumbs}
    LinkComponent={Link}
    scrollable={scrollable}
  />
);

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
