import { Link } from "@tanstack/react-router";
import { Fragment } from "react";

import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import type { BreadcrumbCrumb } from "./crumb";

export const BreadcrumbCrumbItems = ({
  crumbs,
}: {
  crumbs: readonly BreadcrumbCrumb[];
}) => (
  <>
    {crumbs.map((crumb, index) => (
      <Fragment key={crumb.href}>
        {index > 0 && <BreadcrumbSeparator />}
        <BreadcrumbItem>
          {crumb.isCurrent ? (
            <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
          ) : crumb.isLink ? (
            <BreadcrumbLink
              render={<Link to={crumb.href}>{crumb.label}</Link>}
            />
          ) : (
            <span>{crumb.label}</span>
          )}
        </BreadcrumbItem>
      </Fragment>
    ))}
  </>
);
