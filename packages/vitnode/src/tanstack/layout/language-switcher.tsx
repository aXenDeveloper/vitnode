"use client";

import { useLanguages } from "@/components/languages-provider";
import { LanguageSwitcherContent } from "@/components/switchers/langs/language-switcher-content";

import { useLocale } from "../i18n/locale";
import { useSwitchLocale } from "../i18n/switch-locale";

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
