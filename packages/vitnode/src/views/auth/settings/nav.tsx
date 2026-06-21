"use client";

import { ChevronRightIcon, KeyRoundIcon, UserRoundIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import { Link, usePathname } from "@/lib/navigation";
import { cn, normalizeUrl } from "@/lib/utils";

const items = [
  {
    href: "/settings/overview",
    key: "overview",
    icon: UserRoundIcon,
    aliases: ["/settings"],
  },
  { href: "/settings/security", key: "security", icon: KeyRoundIcon },
] as const;

export const NavSettings = () => {
  const t = useTranslations("core.auth.settings.nav");
  const pathname = normalizeUrl(usePathname());

  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ href, key, icon: Icon, ...item }) => {
        const aliases = "aliases" in item ? item.aliases : [];
        const isActive = [href, ...aliases].some(
          url => pathname === normalizeUrl(url),
        );

        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: isActive ? "default" : "ghost" }),
              "w-full justify-start gap-2",
            )}
            href={href}
            key={href}
          >
            <Icon />
            {t(key)}
            <ChevronRightIcon className="ml-auto opacity-60 sm:hidden" />
          </Link>
        );
      })}
    </nav>
  );
};
