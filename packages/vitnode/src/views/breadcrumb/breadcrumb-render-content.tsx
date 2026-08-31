import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

import type { AuthLinkComponent } from "../auth/auth-link";
import type { BreadcrumbCrumb } from "./crumb";

/**
 * A breadcrumb trail, with the one thing it cannot decide for itself handed in.
 *
 * Turning `/settings` into a navigation is the only framework-specific part of a
 * breadcrumb: Next.js wants `next-intl`'s locale-aware `Link`
 * (`@/lib/navigation`), TanStack Start wants the router's own. Both are a
 * component taking an anchor's props, so this takes one and stops caring - and
 * importing neither is what lets a TanStack Start route render the same trail
 * the Next.js `@breadcrumb` slot renders.
 *
 * `AuthLinkComponent` is reused rather than redeclared: it is already "every prop
 * of an anchor, plus a required `href`", which is exactly what a crumb needs and
 * what `RouterLink` in `@vitnode/core/tanstack/layout` already satisfies.
 *
 * Deliberately not a client component. It renders no hooks, and Next.js passes
 * `LinkComponent` into it from a Server Component - a boundary here would turn
 * that prop into something that cannot cross it.
 */
export const BreadcrumbRenderContent = ({
  crumbs,
  LinkComponent,
  scrollable,
}: {
  crumbs: BreadcrumbCrumb[];
  LinkComponent: AuthLinkComponent;
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
                  render={
                    <LinkComponent href={crumb.href}>
                      {crumb.label}
                    </LinkComponent>
                  }
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
