"use client";

import { useLanguages } from "@/components/languages-provider";
import { LanguageSwitcherContent } from "@/components/switchers/langs/language-switcher-content";

import { useLocale } from "../i18n/locale";
import { useSwitchLocale } from "../i18n/switch-locale";

/**
 * VitNode's language switcher, for TanStack Router.
 *
 * The dropdown, the icon, the check mark and the `core.global.language_switcher`
 * label are `LanguageSwitcherContent`'s - literally the same component the
 * Next.js applications render, so the control cannot drift between frameworks.
 * What is forked is the two lines that navigate: core's Next half replaces the
 * pathname through `next-intl`'s locale-aware router, and this one goes through
 * `useSwitchLocale`, which pushes the public href and invalidates.
 *
 * What that preserves is the whole point: the route, its params, its search
 * string and its hash. Only the locale prefix changes - and on a route that
 * carries no prefix (`/admin`) the cookie is the whole of the switch. All of
 * that rule lives in `@vitnode/core/tanstack/i18n`, not here.
 *
 * ## It renders nothing on a single-language install
 *
 * The list comes from `LanguagesProvider`, which a host's root providers already
 * mount from configuration - so this is the same answer the Next.js header
 * reaches, from the provider that was given the list rather than from the config
 * file. One language means nothing to switch to, and the header should not have
 * to ask before rendering it.
 */
export const LanguageSwitcher = () => {
  const languages = useLanguages();
  const locale = useLocale();
  const switchLocale = useSwitchLocale();

  if (languages.length <= 1) return null;

  return (
    <LanguageSwitcherContent
      currentLocale={locale}
      // Narrowed inside `useSwitchLocale`, which refuses a code the app was not
      // configured with - so a click handler carries no locale cast.
      onSelect={switchLocale}
      options={languages}
    />
  );
};
