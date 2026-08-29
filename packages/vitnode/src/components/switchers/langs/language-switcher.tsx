"use client";

import { useLocale } from "next-intl";
import React from "react";

import type { LocaleConfig } from "@/vitnode.config";

import { usePathname, useRouter } from "@/lib/navigation";

import { LanguageSwitcherContent } from "./language-switcher-content";

/**
 * The switch itself, and the reason it is its own component.
 *
 * `useRouter()` and `usePathname()` both read the current URL - `next-intl`'s
 * router calls `usePathname()` internally to sync the locale cookie - and Next 16
 * refuses to prerender a client component that reads URL data outside a
 * `<Suspense>`: `CLIENT_HOOK_DYNAMIC`. The AdminCP sidebar renders this switcher
 * on a prerendered route, so the boundary below is not defensive. It is what
 * makes `next build` pass, and it is why the control was already split this way
 * before it was shared.
 *
 * `pathname` here is `next-intl`'s: the *un-prefixed* one, so replacing it with a
 * different locale cannot produce `/pl/pl/...`. The search string and hash are
 * Next's to preserve, as they always were.
 */
const NextLanguageSwitcher = ({
  isPending,
  locales,
  startTransition,
}: {
  isPending: boolean;
  locales: LocaleConfig[];
  startTransition: React.TransitionStartFunction;
}) => {
  const currentLocale = useLocale();
  const { replace } = useRouter();
  const pathname = usePathname();

  return (
    <LanguageSwitcherContent
      currentLocale={currentLocale}
      isPending={isPending}
      onSelect={locale => {
        startTransition(() => {
          replace(pathname, { locale });
        });
      }}
      options={locales}
    />
  );
};

/**
 * {@link LanguageSwitcherContent}, wired to Next.js.
 *
 * Everything visible moved to the shared control; what is left is the navigation
 * and the boundary it has to render inside. The fallback is the same component
 * with its items disabled - the trigger, the icon and the language names, so the
 * bar reserves its width and reads correctly before the URL is available.
 *
 * `useTransition` lives out here, above the boundary, so the spinner survives the
 * navigation it is reporting on.
 *
 * The TanStack Start half is `src/tanstack/layout/language-switcher.tsx`,
 * over Stage 3's `useSwitchLocale` - which needs no boundary, because the router
 * it reads is not Next's.
 */
export const LanguageSwitcher = ({ locales }: { locales: LocaleConfig[] }) => {
  const [isPending, startTransition] = React.useTransition();

  return (
    <React.Suspense
      fallback={
        <LanguageSwitcherContent isPending={isPending} options={locales} />
      }
    >
      <NextLanguageSwitcher
        isPending={isPending}
        locales={locales}
        startTransition={startTransition}
      />
    </React.Suspense>
  );
};
