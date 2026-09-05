"use client";

import { CheckIcon, LanguagesIcon } from "lucide-react";
import { useTranslations } from "use-intl";

import type { LocaleConfig } from "@/lib/i18n/types";

import { Button } from "../../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";

/**
 * The switch is ready: the current language is known and selecting one does
 * something.
 */
interface LanguageSwitcherReadyProps {
  /** The language the page is currently in, for the check mark. */
  currentLocale: string;
  /** Perform the switch. Given a locale code from `options`. */
  onSelect: (locale: string) => void;
}

interface LanguageSwitcherPendingProps {
  currentLocale?: never;
  onSelect?: never;
}

export type LanguageSwitcherContentProps = (
  LanguageSwitcherPendingProps | LanguageSwitcherReadyProps
) & {
  /** A switch in flight, shown on the trigger. Next.js drives this with a transition. */
  isPending?: boolean;
  /** The languages to offer, in the order they render. */
  options: LocaleConfig[];
};

export const LanguageSwitcherContent = ({
  currentLocale,
  isPending,
  onSelect,
  options,
}: LanguageSwitcherContentProps) => {
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
        {options.map(option => (
          <DropdownMenuItem
            disabled={!onSelect}
            key={option.code}
            onClick={() => {
              onSelect?.(option.code);
            }}
          >
            {option.name}

            {option.code === currentLocale && (
              <CheckIcon aria-hidden className="ml-auto" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
