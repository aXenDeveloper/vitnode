"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "use-intl";

import { useTheme } from "../../theme-provider";
import { Button } from "../../ui/button";

export const ThemeSwitcher = () => {
  const { setTheme, resolvedTheme } = useTheme();
  const t = useTranslations("core.global");

  return (
    <Button
      aria-label={t("theme_switcher")}
      className="relative"
      onClick={() => {
        const nextTheme = resolvedTheme === "dark" ? "light" : "dark";
        setTheme(nextTheme);
      }}
      size="icon"
      variant="ghost"
    >
      <Sun className="size-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
      <Moon className="absolute size-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
    </Button>
  );
};
