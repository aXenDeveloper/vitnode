import {
  BellIcon,
  KeyRoundIcon,
  LinkIcon,
  MenuIcon,
  MonitorSmartphoneIcon,
  SparklesIcon,
  UserRoundIcon,
  XIcon,
} from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { SideNav, SideNavLink, SideNavList } from "@/components/side-nav";
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
  ai: SparklesIcon,
  devices: MonitorSmartphoneIcon,
  notifications: BellIcon,
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
  const tNav = useTranslations("core.auth.settings.nav");

  return (
    <SideNavList>
      {items.map(item => (
        <SideNavLink
          icon={ICONS[item.key]}
          isActive={isSettingsNavItemActive(item, pathname)}
          key={item.href}
          label={tNav(item.key)}
          onNavigate={onNavigate}
          to={item.href}
        />
      ))}
    </SideNavList>
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
          <nav aria-label={t("title")}>
            <SettingsNavList
              items={items}
              onNavigate={() => {
                setIsOpen(false);
              }}
              pathname={pathname}
            />
          </nav>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

const SettingsNavCard = ({
  items,
  pathname,
}: {
  items: readonly SettingsNavItem[];
  pathname: string;
}) => {
  const t = useTranslations("core.auth.settings");

  return (
    <SideNav aria-label={t("title")} className="max-md:hidden">
      <SettingsNavList items={items} pathname={pathname} />
    </SideNav>
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
    <SettingsNavCard items={items} pathname={pathname} />
  </>
);
