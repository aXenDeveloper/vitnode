import { cn } from "cn";
import React from "react";
import { useTranslations } from "use-intl";

import { NewTabIndicator } from "@/components/new-tab-indicator";

import type { HeaderNavItem } from "../header-nav";

import {
  MobileNavIcon,
  MobileNavLink,
  useIsMobileNavHrefActive,
} from "./mobile-nav-parts";

export const mobileNavRowClassName =
  "flex min-h-11 w-full touch-manipulation items-center gap-3 rounded-lg px-3 text-start text-sm font-medium transition-colors duration-150 active:bg-accent aria-[current=page]:bg-accent aria-[current=page]:text-foreground";

export const MobileNavSectionHeading = ({
  children,
  id,
}: {
  children: React.ReactNode;
  id?: string;
}) => (
  <h2 className="text-muted-foreground px-3 text-xs font-medium" id={id}>
    {children}
  </h2>
);

export const MobileNavLinks = ({
  navigation,
  onNavigate,
}: {
  navigation: HeaderNavItem[];
  onNavigate: () => void;
}) => {
  const t = useTranslations("core.global.mobile_nav");
  const isActive = useIsMobileNavHrefActive();
  const headingId = React.useId();
  const currentFor = (href: string) => (isActive(href) ? "page" : undefined);

  if (navigation.length === 0) return null;

  return (
    <nav aria-labelledby={headingId} className="flex flex-col gap-2">
      <MobileNavSectionHeading id={headingId}>
        {t("navigation")}
      </MobileNavSectionHeading>
      <ul className="flex flex-col gap-0.5">
        {navigation.map(item => (
          <li className="flex flex-col gap-0.5" key={item.id}>
            <MobileNavLink
              aria-current={currentFor(item.href)}
              className={mobileNavRowClassName}
              item={item}
              onNavigate={onNavigate}
            >
              <MobileNavIcon
                className="text-muted-foreground size-5 shrink-0"
                icon={item.icon}
                label={item.label}
              />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.isOpenInNewTab ? <NewTabIndicator /> : null}
            </MobileNavLink>

            {item.items?.length ? (
              <ul className="ms-5 flex flex-col gap-0.5 border-s ps-2">
                {item.items.map(child => (
                  <li key={child.id}>
                    <MobileNavLink
                      aria-current={currentFor(child.href)}
                      className={cn(
                        mobileNavRowClassName,
                        "text-muted-foreground",
                      )}
                      item={child}
                      onNavigate={onNavigate}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {child.label}
                      </span>
                      {child.isOpenInNewTab ? <NewTabIndicator /> : null}
                    </MobileNavLink>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </nav>
  );
};
