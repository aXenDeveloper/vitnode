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
      aria-describedby={
        hasDisabledTooltip
          ? [ariaDescribedBy, disabledReasonId].filter(Boolean).join(" ")
          : ariaDescribedBy
      }
      aria-label={isLoading ? t("loading") : props["aria-label"]}
      className={cn(buttonVariants({ variant, size, className }))}
      data-slot="button"
      disabled={isLoading ?? props.disabled}
      focusableWhenDisabled={hasDisabledTooltip || focusableWhenDisabled}
      {...props}
    >
      {isLoading === undefined ? (
        children
      ) : (
        <div className="relative flex items-center justify-center">
          <div
            className={cn(
              "flex items-center justify-center gap-2 transition-opacity duration-300",
              isLoading ? "opacity-0" : "opacity-100",
            )}
          >
            {children}
          </div>

          {isLoading ? (
            <div className="animate-in fade-in slide-in-from-top-2 absolute inset-0 flex items-center justify-center duration-300 motion-reduce:animate-none">
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
