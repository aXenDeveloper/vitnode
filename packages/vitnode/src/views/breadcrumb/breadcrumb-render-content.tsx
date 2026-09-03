import { Fragment } from "react";

import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import type { AuthLinkComponent } from "../auth/auth-link";
import type { BreadcrumbCrumb } from "./crumb";

export const BreadcrumbCrumbItems = ({
  crumbs,
  LinkComponent,
}: {
  crumbs: readonly BreadcrumbCrumb[];
  LinkComponent: AuthLinkComponent;
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
              render={
                <LinkComponent href={crumb.href}>{crumb.label}</LinkComponent>
              }
            />
          ) : (
            <span>{crumb.label}</span>
          )}
        </BreadcrumbItem>
      </Fragment>
    ))}
  </>
);
