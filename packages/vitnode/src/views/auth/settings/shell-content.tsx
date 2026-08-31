"use client";

import { ArrowLeftIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HeaderContent } from "@/components/ui/header-content";
import { cn } from "@/lib/utils";

import type { AuthLinkComponent } from "../auth-link";

import { SETTINGS_ROOT_HREF } from "./settings-nav";

/**
 * The settings screens' frame: the heading, the navigation card, and the panel
 * every settings page renders inside.
 *
 * Presentation only, and framework-free on purpose - it reaches nothing from
 * `next/*`, from `next-intl`'s Next-only entries or from `@/lib/navigation`, so
 * a TanStack Start layout route renders exactly the frame the Next.js layout
 * renders.
 *
 * Two things arrive from outside, and they are the only two:
 *
 * - `nav`, a slot. Each framework builds its own navigation because each has its
 *   own `Link` and its own way of knowing where it is; what the menu *contains*
 *   is shared, in `settings-nav.ts`.
 * - `BackLink`, a component. The mobile back link's markup is presentation and
 *   stays here, so the two frameworks cannot drift into two different buttons -
 *   only the anchor underneath it differs.
 *
 * ## `isRoot` is a prop, not a hook call
 *
 * The whole of the mobile behaviour: on a narrow screen `/settings` shows the
 * heading and the menu, and a panel path shows the panel with a link back to the
 * menu. Both cards render in both cases and one of the two is hidden, so a
 * desktop layout is one grid rather than two - which is why this is a class name
 * rather than a branch.
 *
 * Deciding it needs the current path, which is the one thing this module must
 * not read for itself (see {@link SettingsNavContent}). `isSettingsRootPath` in
 * `settings-nav.ts` is the shared rule; each framework applies it to the
 * pathname its own router holds.
 */
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
