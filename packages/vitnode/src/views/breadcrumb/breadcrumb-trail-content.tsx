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

export interface BreadcrumbTrailContentEntry {
  content: React.ReactNode;
  href: string;
  isCurrent: boolean;
  key: string;
  /** The content renders its own list items, separators included. */
  spansItems: boolean;
}

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
