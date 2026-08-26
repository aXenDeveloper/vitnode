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
