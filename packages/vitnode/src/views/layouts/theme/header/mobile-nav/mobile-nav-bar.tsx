import { cn } from "cn";
import { MenuIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import {
  slidingIndicatorTransitionClassName,
  useSlidingIndicator,
} from "@/hooks/use-sliding-indicator";

import type { HeaderNavChildItem, HeaderNavItem } from "../header-nav";

import { MobileNavLinks } from "./mobile-nav-links";
import {
  MobileNavIcon,
  MobileNavLink,
  useIsMobileNavHrefActive,
} from "./mobile-nav-parts";

const BODY_CLEARANCE_CSS = `@media (width < 40rem){body:has([data-slot="mobile-nav"]){padding-bottom:calc(4.75rem + max(env(safe-area-inset-bottom, 0px), 0.75rem))}}`;

const tabClassName =
  "relative flex h-14 w-full min-w-0 touch-manipulation flex-col items-center justify-center gap-1 rounded-full px-0.5 text-muted-foreground transition-[color,scale] duration-150 ease-out select-none active:scale-[0.96] aria-[current=page]:text-primary aria-expanded:text-primary data-[current=true]:text-primary";

const tabLabelClassName = "w-full truncate text-center text-xs font-medium";

const MenuTab = ({
  isCurrent,
  menuNavigation,
  onOpenChange,
  open,
}: {
  isCurrent: boolean;
  menuNavigation: HeaderNavItem[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const t = useTranslations("core.global.mobile_nav");

  return (
    <>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className={tabClassName}
        data-current={isCurrent}
        onClick={() => {
          onOpenChange(true);
        }}
        type="button"
      >
        <MenuIcon aria-hidden className="size-5" />
        <span className={tabLabelClassName}>{t("menu")}</span>
      </button>

      <Drawer onOpenChange={onOpenChange} open={open}>
        <DrawerContent aria-describedby={undefined} className="max-h-[85dvh]">
          <DrawerTitle className="sr-only">{t("menu")}</DrawerTitle>
          <div className="overflow-y-auto overscroll-contain px-2 pt-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
            <MobileNavLinks
              navigation={menuNavigation}
              onNavigate={() => {
                onOpenChange(false);
              }}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export const MobileNavBar = ({
  items,
  menuNavigation,
}: {
  items: HeaderNavChildItem[];
  menuNavigation: HeaderNavItem[];
}) => {
  const t = useTranslations("core.global.mobile_nav");
  const isActive = useIsMobileNavHrefActive();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const hasMenu = menuNavigation.length > 0;
  const activeIndex = items.findIndex(item => isActive(item.href));
  const isInMenu =
    hasMenu &&
    activeIndex === -1 &&
    menuNavigation.some(
      item =>
        isActive(item.href) || item.items?.some(child => isActive(child.href)),
    );
  const highlightedIndex = isMenuOpen || isInMenu ? items.length : activeIndex;
  const { containerRef, indicatorRef, isReady } =
    useSlidingIndicator<HTMLDivElement>(highlightedIndex);

  if (items.length === 0) return null;

  return (
    <>
      <style href="vitnode-mobile-nav" precedence="default">
        {BODY_CLEARANCE_CSS}
      </style>
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:hidden"
        data-slot="mobile-nav"
      >
        <nav
          aria-label={t("label")}
          className="bg-popover text-popover-foreground pointer-events-auto flex w-full max-w-md items-center rounded-full p-1 shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_2px_4px_rgb(0_0_0/0.06),0_12px_32px_-8px_rgb(0_0_0/0.2)] dark:shadow-[0_0_0_1px_rgb(255_255_255/0.1)]"
        >
          <div className="relative flex min-w-0 flex-1" ref={containerRef}>
            <span
              aria-hidden
              className={cn(
                "bg-accent pointer-events-none absolute top-0 left-0 rounded-full opacity-0",
                isReady && slidingIndicatorTransitionClassName,
              )}
              ref={indicatorRef}
            />
            <ul className="flex min-w-0 flex-1 items-center">
              {items.map(item => (
                <li
                  className="flex min-w-0 flex-1"
                  data-sliding-indicator-item
                  key={item.id}
                >
                  <MobileNavLink
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={tabClassName}
                    item={item}
                  >
                    <MobileNavIcon
                      className="size-5"
                      icon={item.icon}
                      label={item.label}
                    />
                    <span className={tabLabelClassName}>{item.label}</span>
                  </MobileNavLink>
                </li>
              ))}
              {hasMenu ? (
                <li className="flex min-w-0 flex-1" data-sliding-indicator-item>
                  <MenuTab
                    isCurrent={isInMenu}
                    menuNavigation={menuNavigation}
                    onOpenChange={setIsMenuOpen}
                    open={isMenuOpen}
                  />
                </li>
              ) : null}
            </ul>
          </div>
        </nav>
      </div>
    </>
  );
};
