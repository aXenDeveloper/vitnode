import { cn } from "cn";
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
  themeSegmentClassName,
  themeSegmentPressedClassName,
  themeSegmentsClassName,
} from "./theme-options";

export const ThemeSegmentedControl = ({
  className,
}: {
  className?: string;
}) => {
  const { setTheme, theme } = useTheme();
  const t = useTranslations("core.global.theme");
  const { containerRef, indicatorRef, isReady } =
    useSlidingIndicator<HTMLDivElement>(themeActiveIndex(theme));

  return (
    <div
      aria-label={t("label")}
      className={cn(themeSegmentsClassName, className)}
      ref={containerRef}
      role="group"
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
        <button
          aria-pressed={theme === value}
          className={cn(themeSegmentClassName, themeSegmentPressedClassName)}
          data-sliding-indicator-item
          key={value}
          onClick={() => {
            setTheme(value);
          }}
          type="button"
        >
          <Icon aria-hidden />
          <span className="w-full truncate text-center">{t(value)}</span>
        </button>
      ))}
    </div>
  );
};
