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

/**
 * One contributor's place in a rendered trail.
 *
 * Structural rather than imported from `@vitnode/core/tanstack/breadcrumb`,
 * because this file is a view: it renders the trail a router-aware shell
 * collected, and may not import the router-aware half that collects it.
 */
export interface BreadcrumbTrailContentEntry {
  content: React.ReactNode;
  href: string;
  isCurrent: boolean;
  key: string;
  /** The content renders its own list items, separators included. */
  spansItems: boolean;
}

/**
 * The whole breadcrumb trail: one navigation landmark, one list, one separator
 * between neighbours.
 *
 * This is the half that owns the semantics, and the reason a route contributes a
 * *label* rather than a trail: the `nav`, the ordered list, the separators and
 * the `aria-current` on the last crumb are decided here, once, so every crumb in
 * every shell reads the same way and a plugin never has to know it is the third
 * of five.
 *
 * A crumb that is not the current page is a link to its own matched route's URL,
 * built with the `LinkComponent` a shell hands in - which is what makes the trail
 * locale-aware without a single crumb mentioning a locale.
 *
 * `spansItems` is the AdminCP's case: those crumbs come from one route and are
 * rendered by `BreadcrumbCrumbItems`, which emits its own items into this list.
 */
export const BreadcrumbTrailContent = ({
  entries,
  LinkComponent,
  scrollable,
}: {
  entries: readonly BreadcrumbTrailContentEntry[];
  LinkComponent: AuthLinkComponent;
  scrollable?: boolean;
}) => {
  if (entries.length === 0) return null;

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
        {entries.map((entry, index) => (
          <Fragment key={entry.key}>
            {index > 0 && <BreadcrumbSeparator />}
            {entry.spansItems ? (
              entry.content
            ) : (
              <BreadcrumbItem>
                {entry.isCurrent ? (
                  <BreadcrumbPage>{entry.content}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    render={
                      <LinkComponent href={entry.href}>
                        {entry.content}
                      </LinkComponent>
                    }
                  />
                )}
              </BreadcrumbItem>
            )}
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
};
