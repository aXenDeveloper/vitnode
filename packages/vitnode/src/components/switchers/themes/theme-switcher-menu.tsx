import { Menu as MenuPrimitive } from "@base-ui/react/menu";
import { cn } from "cn";
import React from "react";
import { useTranslations } from "use-intl";

import {
  slidingIndicatorTransitionClassName,
  useSlidingIndicator,
} from "@/hooks/use-sliding-indicator";

import { useTheme } from "../../theme-provider";
import {
  THEME_OPTIONS,
  themeActiveIndex,
  themeIndicatorClassName,
  themeSegmentCheckedClassName,
  themeSegmentClassName,
  themeSegmentsClassName,
} from "./theme-options";

export const ThemeSwitcherMenu = () => {
  const { setTheme, theme } = useTheme();
  const t = useTranslations("core.global.theme");
  const labelId = React.useId();
  const { containerRef, indicatorRef, isReady } =
    useSlidingIndicator<HTMLDivElement>(themeActiveIndex(theme));

  return (
    <div className="flex flex-col gap-1 px-1 py-1.5" data-slot="theme-switcher">
      <span
        className="text-muted-foreground px-1 text-xs font-medium"
        id={labelId}
      >
        {t("label")}
      </span>

      <MenuPrimitive.RadioGroup
        aria-labelledby={labelId}
        className={themeSegmentsClassName}
        onValueChange={setTheme}
        ref={containerRef}
        value={theme}
      >
        <span
          aria-hidden
          className={cn(
            themeIndicatorClassName,
            isReady && slidingIndicatorTransitionClassName,
          )}
          ref={indicatorRef}
        />
        {THEME_OPTIONS.map(({ Icon, value }) => (
          <MenuPrimitive.RadioItem
            className={cn(themeSegmentClassName, themeSegmentCheckedClassName)}
            closeOnClick={false}
            data-sliding-indicator-item
            key={value}
            value={value}
          >
            <Icon aria-hidden />
            <span className="w-full truncate text-center">{t(value)}</span>
          </MenuPrimitive.RadioItem>
        ))}
      </MenuPrimitive.RadioGroup>
    </div>
  );
};
