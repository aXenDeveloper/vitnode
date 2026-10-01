import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import {
  KeyRoundIcon,
  LinkIcon,
  MenuIcon,
  MonitorSmartphoneIcon,
  UserRoundIcon,
  XIcon,
} from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

import type { SettingsNavItem, SettingsNavKey } from "./settings-nav";

import { isSettingsNavItemActive, SETTINGS_NAV_ITEMS } from "./settings-nav";

const ICONS: Record<
  SettingsNavKey,
  React.ComponentType<{ className?: string }>
> = {
  devices: MonitorSmartphoneIcon,
  overview: UserRoundIcon,
  security: KeyRoundIcon,
  sso: LinkIcon,
};

const SettingsNavList = ({
  items,
  onNavigate,
  pathname,
}: {
  items: readonly SettingsNavItem[];
  onNavigate?: () => void;
  pathname: string;
}) => {
  const t = useTranslations("core.auth.settings");
  const tNav = useTranslations("core.auth.settings.nav");
  const activeIndex = items.findIndex(item =>
    isSettingsNavItemActive(item, pathname),
  );

  return (
    <nav aria-label={t("title")}>
      <ul
        className="relative flex flex-col ps-3"
        style={{ "--active": activeIndex } as React.CSSProperties}
      >
        {activeIndex >= 0 ? (
          <span
            aria-hidden="true"
            className="bg-card ring-foreground/5 dark:bg-muted before:bg-primary pointer-events-none absolute inset-s-3 inset-e-0 top-0 h-10 translate-y-[calc(var(--active)*100%)] rounded-md shadow-xs ring-1 transition-[translate] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] before:absolute before:inset-y-2 before:-inset-s-3 before:w-1 before:rounded-full motion-reduce:transition-none dark:shadow-none dark:ring-0"
          />
        ) : null}
        {items.map(item => {
          const Icon = ICONS[item.key];
          const isActive = isSettingsNavItemActive(item, pathname);

          return (
            <li key={item.href}>
              <Link
                activeOptions={{ exact: true }}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "focus-visible:ring-ring/50 relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-inset",
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
                )}
                onClick={onNavigate}
                to={item.href}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                {tNav(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

const SettingsNavDrawer = ({
  items,
  pathname,
}: {
  items: readonly SettingsNavItem[];
  pathname: string;
}) => {
  const t = useTranslations("core.auth.settings");
  const tGlobal = useTranslations("core.global");
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Drawer direction="left" onOpenChange={setIsOpen} open={isOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline">
          <MenuIcon aria-hidden="true" />
          {t("title")}
        </Button>
      </DrawerTrigger>

      <DrawerContent aria-describedby={undefined}>
        <div className="flex items-center justify-between gap-2 px-4 pt-[max(env(safe-area-inset-top),1rem)]">
          <DrawerTitle className="text-base font-semibold">
            {t("title")}
          </DrawerTitle>
          <DrawerClose asChild>
            <Button aria-label={tGlobal("close")} size="icon" variant="ghost">
              <XIcon />
            </Button>
          </DrawerClose>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <SettingsNavList
            items={items}
            onNavigate={() => {
              setIsOpen(false);
            }}
            pathname={pathname}
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export const SettingsNavContent = ({
  items = SETTINGS_NAV_ITEMS,
  pathname,
}: {
  items?: readonly SettingsNavItem[];
  pathname: string;
}) => (
  <>
    <div className="md:hidden">
      <SettingsNavDrawer items={items} pathname={pathname} />
    </div>
    <div className="max-md:hidden">
      <SettingsNavList items={items} pathname={pathname} />
    </div>
  </>
);
