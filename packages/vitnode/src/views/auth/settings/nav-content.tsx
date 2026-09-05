"use client";

import {
  ChevronRightIcon,
  KeyRoundIcon,
  MonitorSmartphoneIcon,
  UserRoundIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { AuthLinkComponent } from "../auth-link";
import type { SettingsNavKey } from "./settings-nav";

import { isSettingsNavItemActive, SETTINGS_NAV_ITEMS } from "./settings-nav";

const ICONS: Record<SettingsNavKey, React.ComponentType> = {
  devices: MonitorSmartphoneIcon,
  overview: UserRoundIcon,
  security: KeyRoundIcon,
};

export const SettingsNavContent = ({
  LinkComponent,
  pathname,
}: {
  LinkComponent: AuthLinkComponent;
  pathname: string;
}) => {
  const t = useTranslations("core.auth.settings.nav");

  return (
    <nav className="flex flex-col gap-1">
      {SETTINGS_NAV_ITEMS.map(item => {
        const Icon = ICONS[item.key];
        const isActive = isSettingsNavItemActive(item, pathname);

        return (
          <LinkComponent
            aria-current={isActive ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: isActive ? "default" : "ghost" }),
              "w-full justify-start gap-2",
            )}
            href={item.href}
            key={item.href}
          >
            <Icon />
            {t(item.key)}
            <ChevronRightIcon className="ml-auto opacity-60 sm:hidden" />
          </LinkComponent>
        );
      })}
    </nav>
  );
};
