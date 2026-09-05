"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { useTranslations } from "use-intl";

import { cn } from "../../lib/utils";
import { type ButtonProps, buttonVariants } from "./button";
import { Loader } from "./loader";

export function ClientButton({
  className,
  variant,
  size,
  isLoading,
  children,
  ...props
}: ButtonProps) {
  const t = useTranslations("core.global");

  return (
    <ButtonPrimitive
      aria-label={isLoading ? t("loading") : props["aria-label"]}
      className={cn(buttonVariants({ variant, size, className }))}
      data-slot="button"
      disabled={isLoading ?? props.disabled}
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
              <Loader small />
            </div>
          ) : null}
        </div>
      )}
    </ButtonPrimitive>
  );
}
