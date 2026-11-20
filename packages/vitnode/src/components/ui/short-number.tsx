import { cn } from "cn";
import React from "react";
import { useLocale } from "use-intl";

import { TooltipWithContent } from "./tooltip";

type NumberFormatOptions = Omit<
  Intl.NumberFormatOptions,
  "compactDisplay" | "notation"
>;

/**
 * The short and full forms of `value` in `locale`: `1.2K` and `1,234`. Values
 * under `threshold` keep their full form. Pure; universal.
 */
export const formatShortNumber = (
  value: number,
  {
    formatOptions,
    locale,
    threshold = 1000,
  }: {
    formatOptions?: NumberFormatOptions;
    locale: string;
    threshold?: number;
  },
): { full: string; short: string; shortened: boolean } => {
  const full = new Intl.NumberFormat(locale, formatOptions).format(value);
  if (Math.abs(value) < threshold)
    return { full, short: full, shortened: false };

  const short = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    ...formatOptions,
    compactDisplay: "short",
    notation: "compact",
  }).format(value);

  return { full, short, shortened: short !== full };
};

export interface ShortNumberProps extends Omit<
  React.ComponentProps<"span">,
  "children"
> {
  /** Options for both forms, such as `{ signDisplay: "exceptZero" }` for `+1.2K`. */
  formatOptions?: NumberFormatOptions;
  /** Values below this are shown in full. Defaults to `1000`. */
  threshold?: number;
  /**
   * Show the full number in a tooltip when it was shortened. Defaults to
   * `true`; turn it off where the parent already explains the number, such as
   * a button with its own label or tooltip.
   */
  tooltip?: boolean;
  value: number;
}

/**
 * A number in its short form - `1.2K`, `3.4M` - in the user's language, with
 * the full formatted number in a tooltip. Screen readers always hear the full
 * number. Uses tabular figures and inherits font size and color. Universal.
 *
 * @example
 * ```tsx
 * import { ShortNumber } from "@vitnode/core/components/ui/short-number";
 *
 * <ShortNumber value={12480} />; // 12.5K, tooltip "12,480"
 * <ShortNumber formatOptions={{ signDisplay: "exceptZero" }} value={-37} />; // -37
 * <ShortNumber tooltip={false} value={1500} />; // 1.5K, no tooltip
 * ```
 */
export const ShortNumber = ({
  className,
  formatOptions,
  threshold,
  tooltip = true,
  value,
  ...props
}: ShortNumberProps) => {
  const locale = useLocale();
  const { full, short, shortened } = formatShortNumber(value, {
    formatOptions,
    locale,
    threshold,
  });

  const content = (
    <span className={cn("tabular-nums", className)} {...props}>
      {shortened ? (
        <>
          <span aria-hidden="true">{short}</span>
          <span className="sr-only">{full}</span>
        </>
      ) : (
        full
      )}
    </span>
  );

  if (!shortened || !tooltip) return content;

  return <TooltipWithContent text={full}>{content}</TooltipWithContent>;
};
