import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cn } from "cn";
import React from "react";
import { useTranslations } from "use-intl";

import { type ButtonProps, buttonVariants } from "./button";
import { Spinner } from "./spinner";
import { TooltipWithContent } from "./tooltip";

export function ClientButton({
  className,
  variant,
  size,
  isLoading,
  disabledTooltip,
  focusableWhenDisabled,
  "aria-describedby": ariaDescribedBy,
  children,
  ...props
}: ButtonProps) {
  const t = useTranslations("core.global");
  const disabledReasonId = React.useId();
  const hasDisabledTooltip =
    !isLoading &&
    Boolean(props.disabled) &&
    disabledTooltip !== undefined &&
    disabledTooltip !== null;

  const button = (
    <ButtonPrimitive
      {...props}
      aria-describedby={
        hasDisabledTooltip
          ? [ariaDescribedBy, disabledReasonId].filter(Boolean).join(" ")
          : ariaDescribedBy
      }
      aria-label={isLoading ? t("loading") : props["aria-label"]}
      className={cn(buttonVariants({ variant, size, className }))}
      data-slot="button"
      disabled={isLoading === true || props.disabled}
      focusableWhenDisabled={hasDisabledTooltip || focusableWhenDisabled}
    >
      {isLoading === undefined ? (
        children
      ) : (
        <div className="relative flex items-center justify-center">
          <div
            className={cn(
              "ease-fluid flex items-center justify-center gap-2 transition-[opacity,scale,filter] duration-150 motion-reduce:scale-100 motion-reduce:blur-none motion-reduce:transition-opacity",
              isLoading ? "scale-75 opacity-0 blur-xs" : "opacity-100",
            )}
          >
            {children}
          </div>

          {isLoading ? (
            <div className="ease-fluid absolute inset-0 flex items-center justify-center transition-[opacity,scale,filter] duration-150 motion-reduce:transition-opacity starting:scale-75 starting:opacity-0 starting:blur-xs motion-reduce:starting:scale-100 motion-reduce:starting:blur-none">
              <Spinner aria-hidden="true" />
            </div>
          ) : null}
        </div>
      )}

      {hasDisabledTooltip ? (
        <span hidden id={disabledReasonId}>
          {disabledTooltip}
        </span>
      ) : null}
    </ButtonPrimitive>
  );

  if (!hasDisabledTooltip) return button;

  return (
    <TooltipWithContent text={disabledTooltip}>{button}</TooltipWithContent>
  );
}
