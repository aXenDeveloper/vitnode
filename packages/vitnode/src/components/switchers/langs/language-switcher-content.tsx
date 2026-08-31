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
 * The language switcher, minus the one thing that differs between frameworks.
 *
 * The dropdown, the icon, the check mark on the current language and the
 * `core.global.language_switcher` label are the same control everywhere. What is
 * not the same is *how* switching language moves the URL: Next.js replaces the
 * current pathname through `next-intl`'s locale-aware router, TanStack Start
 * pushes the public href and invalidates (`useSwitchLocale`, Stage 3). That is
 * two lines, and they are the only two that are passed in.
 *
 * Before this existed `apps/web` carried its own copy of the markup with a
 * comment explaining that copying it was cheaper than an abstraction satisfying
 * both. It was - until the header needed the same control in both apps, at which
 * point one dropdown with an `onSelect` is smaller than either.
 *
 * Framework-free: `use-intl` rather than `next-intl`, and no navigation import at
 * all. `core.global` is mounted by both apps' root providers, so the label
 * resolves in either.
 */

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

/**
 * The switch is not ready, and the items render disabled.
 *
 * This is not a loading state for the *data* - the language list is
 * configuration and is always in hand. It is for the framework's navigation:
 * Next.js resolves the current pathname from `usePathname()`, which is URL data,
 * and Next 16 refuses to prerender a client component that reads it outside a
 * `<Suspense>`. So the Next.js half renders this shape as its fallback and the
 * real one inside the boundary - which is exactly the structure this control had
 * before it was shared.
 *
 * Written as the other half of a union rather than as two independent optional
 * props: "a current locale but no handler" is not a state this control has, and
 * a caller that produced one would render a check mark next to items that do
 * nothing.
 */
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
