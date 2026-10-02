import { cn } from "cn";
import { MinusIcon, PlusIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Button } from "./button";
import { SlidingNumber } from "./sliding-number";

export const clampCounterValue = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

function Counter({
  className,
  defaultValue = 0,
  disabled = false,
  max = Number.POSITIVE_INFINITY,
  min = Number.NEGATIVE_INFINITY,
  onValueChange,
  step = 1,
  value,
  ...props
}: Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  defaultValue?: number;
  disabled?: boolean;
  max?: number;
  min?: number;
  onValueChange?: (value: number) => void;
  step?: number;
  value?: number;
}) {
  const t = useTranslations("core.global");
  const [uncontrolledValue, setUncontrolledValue] = React.useState(() =>
    clampCounterValue(defaultValue, min, max),
  );
  const current = value ?? uncontrolledValue;

  const change = (direction: -1 | 1) => {
    const next = clampCounterValue(current + direction * step, min, max);
    if (next === current) return;

    setUncontrolledValue(next);
    onValueChange?.(next);
  };

  return (
    <div
      className={cn(
        "bg-card inline-flex items-center gap-1 rounded-lg border p-1 shadow-xs",
        className,
      )}
      data-slot="counter"
      role="group"
      {...props}
    >
      <Button
        aria-label={t("decrease")}
        className="transition-transform active:scale-90 motion-reduce:transition-none"
        disabled={disabled || current <= min}
        onClick={() => {
          change(-1);
        }}
        size="icon-sm"
        variant="ghost"
      >
        <MinusIcon />
      </Button>
      <output
        aria-live="polite"
        className="flex min-w-8 justify-center px-1 text-sm font-medium"
        data-slot="counter-value"
      >
        <SlidingNumber value={current} />
      </output>
      <Button
        aria-label={t("increase")}
        className="transition-transform active:scale-90 motion-reduce:transition-none"
        disabled={disabled || current >= max}
        onClick={() => {
          change(1);
        }}
        size="icon-sm"
        variant="ghost"
      >
        <PlusIcon />
      </Button>
    </div>
  );
}

export { Counter };
