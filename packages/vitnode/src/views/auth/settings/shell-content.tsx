"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HeaderContent } from "@/components/ui/header-content";
import { cn } from "@/lib/utils";

import type { AuthLinkComponent } from "../auth-link";

import { SETTINGS_ROOT_HREF } from "./settings-nav";

export const SettingsShellContent = ({
  BackLink,
  children,
  isRoot,
  nav,
}: {
  BackLink: AuthLinkComponent;
  children: React.ReactNode;
  isRoot: boolean;
  nav: React.ReactNode;
}) => {
  const t = useTranslations("core.auth.settings");

  return (
    <div className="container mx-auto space-y-6 px-4">
      <HeaderContent
        className={cn(!isRoot && "hidden md:flex")}
        desc={t("desc")}
        h1={t("title")}
      />

      <div className="flex flex-col items-start gap-6 md:flex-row">
        <Card
          className={cn(
            "w-full md:w-80 md:shrink-0",
            !isRoot && "hidden md:flex",
          )}
        >
          <CardContent>{nav}</CardContent>
        </Card>

        <Card
          className={cn("w-full min-w-0 flex-1", isRoot && "hidden md:flex")}
        >
          <CardContent>
            <BackLink
              className={cn(
                buttonVariants({ size: "sm", variant: "ghost" }),
                "mb-4 w-full justify-start gap-2 p-0 md:hidden",
              )}
              href={SETTINGS_ROOT_HREF}
            >
              <ArrowLeftIcon />
              {t("title")}
            </BackLink>

            {children}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
