import { Link } from "@tanstack/react-router";
import { cn } from "cn";
import {
  ChevronRightIcon,
  KeyRoundIcon,
  MonitorSmartphoneIcon,
  UserRoundIcon,
} from "lucide-react";
import { useTranslations } from "use-intl";

import type { SettingsNavKey } from "./settings-nav";

import { SETTINGS_INTERACTIVE_ROW } from "./settings-group";
import {
  isSettingsNavItemActive,
  SETTINGS_NAV_ITEMS,
  SETTINGS_ROOT_HREF,
} from "./settings-nav";

const ICONS: Record<
  SettingsNavKey,
  React.ComponentType<{ className?: string }>
> = {
  devices: MonitorSmartphoneIcon,
  overview: UserRoundIcon,
  security: KeyRoundIcon,
};

export const SettingsNavContent = ({ pathname }: { pathname: string }) => {
  const t = useTranslations("core.auth.settings");
  const tNav = useTranslations("core.auth.settings.nav");

  return (
    <nav aria-label={t("title")}>
      <ul className="bg-card ring-foreground/10 divide-y overflow-hidden rounded-xl shadow-xs ring-1">
        {SETTINGS_NAV_ITEMS.map(item => {
          const Icon = ICONS[item.key];
          const isActive = isSettingsNavItemActive(item, pathname);

          return (
            <li
              className={cn(
                item.href === SETTINGS_ROOT_HREF && "max-md:hidden",
              )}
              key={item.href}
            >
              <Link
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  SETTINGS_INTERACTIVE_ROW,
                  isActive && "md:bg-muted",
                )}
                to={item.href}
              >
                <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-4" />
                </span>
                <span className="text-foreground min-w-0 flex-1 text-sm font-medium">
                  {tNav(item.key)}
                </span>
                <ChevronRightIcon
                  aria-hidden="true"
                  className="text-muted-foreground size-4 shrink-0 rtl:rotate-180"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
