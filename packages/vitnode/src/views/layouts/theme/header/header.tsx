import { getTranslations } from "next-intl/server";
import React from "react";

import type { VitNodeConfig } from "@/vitnode.config";

import { LanguageSwitcher } from "@/components/switchers/langs/language-switcher";
import { ThemeSwitcher } from "@/components/switchers/themes/theme-switcher";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/lib/navigation";
import { cn } from "@/lib/utils";

import { UserHeader } from "./user/user";

export const HeaderLayout = async ({
  logo,
  className,
  vitNodeConfig,
  ...props
}: React.ComponentProps<"header"> & {
  logo: React.ReactNode;
  vitNodeConfig: VitNodeConfig;
}) => {
  const t = await getTranslations("core.search");

  return (
    <header
      className={cn("sticky top-0 z-20 w-full sm:top-2 sm:mb-2", className)}
      {...props}
    >
      <div className="dark:bg-background/75 bg-card/75 container mx-auto flex h-14 items-center border-b px-4 py-2 backdrop-blur sm:rounded-lg sm:border sm:shadow-sm">
        <Link href="/">{logo}</Link>

        <nav className="ms-4 hidden items-center gap-1 sm:flex">
          <Link
            className={buttonVariants({ variant: "ghost", size: "sm" })}
            href="/discover"
          >
            {t("nav.discover")}
          </Link>
          <Link
            className={buttonVariants({ variant: "ghost", size: "sm" })}
            href="/search"
          >
            {t("nav.search")}
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {vitNodeConfig.i18n.locales.length > 1 && (
            <LanguageSwitcher locales={vitNodeConfig.i18n.locales} />
          )}
          <ThemeSwitcher />
          <React.Suspense fallback={<Skeleton className="h-9 w-32" />}>
            <UserHeader />
          </React.Suspense>
        </div>
      </div>
    </header>
  );
};
