import { Fragment } from "react";

import {
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import type { AuthLinkComponent } from "../auth/auth-link";
import type { BreadcrumbCrumb } from "./crumb";

/**
 * A run of crumbs, as list items - with the one thing they cannot decide for
 * themselves handed in.
 *
 * Items only, and no `<Breadcrumb>` wrapper: the shell renders exactly one `nav`
 * and one `<ol>` for the whole trail, and every contributor's items go inside
 * it. Rendering a second list here would nest a navigation landmark inside
 * another one, and would put a route's crumbs in an `<ol>` of their own where a
 * screen reader announces them as a separate list.
 *
 * Turning `/settings` into a navigation is the only framework-specific part of a
 * breadcrumb, so this takes a `LinkComponent` and stops caring. `AuthLinkComponent`
 * is reused rather than redeclared: it is already "every prop of an anchor, plus
 * a required `href`", which is exactly what a crumb needs and what `RouterLink`
 * in `@vitnode/core/tanstack/layout` already satisfies.
 *
 * Deliberately not a client component. It renders no hooks and takes its link
 * component as a prop, so it can be rendered from anywhere.
 */
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
