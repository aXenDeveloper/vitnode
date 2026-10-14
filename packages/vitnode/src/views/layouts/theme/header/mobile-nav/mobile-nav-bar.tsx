import { MenuIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

import type { HeaderNavChildItem, HeaderNavItem } from "../header-nav";

import { useIsNavHrefActive } from "../use-is-nav-href-active";
import { MobileNavLinks } from "./mobile-nav-links";
import { MobileNavIcon, MobileNavLink } from "./mobile-nav-parts";

const BODY_CLEARANCE_CSS = `@media (width < 40rem){body:has([data-slot="mobile-nav"]){padding-bottom:calc(4rem + env(safe-area-inset-bottom, 0px))}}`;

const tabClassName =
  "flex h-16 w-full min-w-0 touch-manipulation flex-col items-center justify-center gap-1 px-1 text-muted-foreground transition-colors duration-150 ease-out select-none active:text-foreground aria-[current=page]:text-primary aria-expanded:text-primary data-[current=true]:text-primary";

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
        <MenuIcon aria-hidden className="size-6" />
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
  const isActive = useIsNavHrefActive();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  const hasMenu = menuNavigation.length > 0;
  const isInMenu =
    hasMenu &&
    !items.some(item => isActive(item.href)) &&
    menuNavigation.some(
      item =>
        isActive(item.href) || item.items?.some(child => isActive(child.href)),
    );

  if (items.length === 0) return null;

  return (
    <>
      <style href="vitnode-mobile-nav" precedence="default">
        {BODY_CLEARANCE_CSS}
      </style>
      <nav
        aria-label={t("label")}
        className="bg-card text-card-foreground fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)] sm:hidden"
        data-slot="mobile-nav"
      >
        <ul className="mx-auto flex max-w-lg items-stretch">
          {items.map(item => (
            <li className="flex min-w-0 flex-1" key={item.id}>
              <MobileNavLink
                aria-current={isActive(item.href) ? "page" : undefined}
                className={tabClassName}
                item={item}
              >
                <MobileNavIcon
                  className="size-6"
                  icon={item.icon}
                  label={item.label}
                />
                <span className={tabLabelClassName}>{item.label}</span>
              </MobileNavLink>
            </li>
          ))}
          {hasMenu ? (
            <li className="flex min-w-0 flex-1">
              <MenuTab
                isCurrent={isInMenu}
                menuNavigation={menuNavigation}
                onOpenChange={setIsMenuOpen}
                open={isMenuOpen}
              />
            </li>
          ) : null}
        </ul>
      </nav>
    </>
  );
};
