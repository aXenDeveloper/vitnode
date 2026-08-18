"use client";

import { CheckIcon, LanguagesIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import React from "react";

import type { LocaleConfig } from "@/vitnode.config";

import { usePathname, useRouter } from "@/lib/navigation";

import { Button } from "../../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";

/**
 * The switchable locales. Split out because it is the only part that reads
 * `usePathname()` - switching locale means re-navigating to the current path.
 *
 * This component sits in the header of every themed route, so reading the
 * pathname in the switcher body kept the whole header out of the static shell on
 * any route with dynamic params. Keeping the read down here leaves the trigger
 * button prerendered and suspends only the menu items, which are behind a closed
 * dropdown anyway.
 */
const LanguageSwitcherItems = ({
  locales,
  startTransition,
}: {
  locales: LocaleConfig[];
  startTransition: React.TransitionStartFunction;
}) => {
  const currentLocale = useLocale();
  const { replace } = useRouter();
  const pathname = usePathname();

  return locales.map(locale => (
    <DropdownMenuItem
      key={locale.code}
      onClick={() => {
        startTransition(() => {
          replace(pathname, {
            locale: locale.code,
          });
        });
      }}
    >
      {locale.name}
      {locale.code === currentLocale && <CheckIcon className="ml-auto" />}
    </DropdownMenuItem>
  ));
};

export const LanguageSwitcher = ({ locales }: { locales: LocaleConfig[] }) => {
  const [isPending, startTransition] = React.useTransition();
  const t = useTranslations("core.global");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={t("language_switcher")}
            className="relative"
            isLoading={isPending}
            size="icon"
            variant="ghost"
          />
        }
      >
        <LanguagesIcon />
      </DropdownMenuTrigger>

      <DropdownMenuContent>
        {/* The fallback holds the menu's final size, so opening it mid-stream
            doesn't resize the popup under the pointer. */}
        <React.Suspense
          fallback={locales.map(locale => (
            <DropdownMenuItem disabled key={locale.code}>
              {locale.name}
            </DropdownMenuItem>
          ))}
        >
          <LanguageSwitcherItems
            locales={locales}
            startTransition={startTransition}
          />
        </React.Suspense>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
