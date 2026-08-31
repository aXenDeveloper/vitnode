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

/**
 * The settings navigation, with the two things it cannot resolve for itself
 * handed in.
 *
 * `pathname` rather than a hook, and `LinkComponent` rather than an import: both
 * are the same seam `HeaderContent` and `SearchFeedContent` already draw, and
 * both exist for the same reason. `usePathname` and a locale-aware `Link` come
 * from `next-intl` in the Next.js app and from the router in TanStack Start, and
 * importing either here would make this module Next-only - which is exactly what
 * `views/auth/auth-boundaries.test.ts` pins.
 *
 * The pathname is *internal* - no locale prefix. Each framework's wrapper hands
 * over the spelling its own router uses, and nothing here localizes an href
 * either: `LinkComponent` does that, once.
 */
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
