import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field";
import { cn } from "cn";
import { MinusIcon, PlusIcon } from "lucide-react";
import React from "react";
import { useLocale, useTranslations } from "use-intl";

type NumberFieldSize = "default" | "lg" | "sm";

const stepperButtonClassName =
  "text-muted-foreground hover:bg-muted hover:text-foreground relative flex shrink-0 cursor-pointer items-center justify-center px-2.5 transition-colors outline-none select-none active:bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent group-data-[size=lg]/number-field:px-3 group-data-[size=sm]/number-field:px-2 pointer-coarse:after:absolute pointer-coarse:after:top-1/2 pointer-coarse:after:left-1/2 pointer-coarse:after:size-11 pointer-coarse:after:-translate-1/2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:transition-transform [&_svg]:duration-150 [&_svg]:ease-out active:[&_svg]:scale-90 motion-reduce:[&_svg]:transition-none [&_svg:not([class*='size-'])]:size-4 group-data-[size=sm]/number-field:[&_svg:not([class*='size-'])]:size-3.5";

function NumberField({
  className,
  locale,
  size = "default",
  ...props
}: NumberFieldPrimitive.Root.Props & { size?: NumberFieldSize }) {
  const appLocale = useLocale();

  return (
    <NumberFieldPrimitive.Root
      className={cn(
        "group/number-field flex w-full flex-col items-start gap-2",
        className,
      )}
      data-size={size}
      data-slot="number-field"
      locale={locale ?? appLocale}
      {...props}
    />
  );
}

function NumberFieldGroup({
  className,
  ...props
}: NumberFieldPrimitive.Group.Props) {
  return (
    <NumberFieldPrimitive.Group
      className={cn(
        "border-input focus-within:border-ring focus-within:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:border-destructive/50 dark:has-aria-invalid:ring-destructive/40 dark:bg-input/30 bg-card relative flex h-9 w-full min-w-0 items-stretch rounded-md border shadow-xs transition-[color,box-shadow] group-data-[size=lg]/number-field:h-10 group-data-[size=sm]/number-field:h-8 focus-within:ring-3 has-aria-invalid:ring-3 data-disabled:opacity-50",
        className,
      )}
      data-slot="number-field-group"
      {...props}
    />
  );
}

function NumberFieldInput({
  className,
  ...props
}: NumberFieldPrimitive.Input.Props) {
  return (
    <NumberFieldPrimitive.Input
      className={cn(
        "placeholder:text-muted-foreground w-full min-w-0 flex-1 bg-transparent px-2 text-center text-base tabular-nums outline-none disabled:cursor-not-allowed md:text-sm",
        className,
      )}
      data-slot="number-field-input"
      {...props}
    />
  );
}

function NumberFieldDecrement({
  children,
  className,
  ...props
}: NumberFieldPrimitive.Decrement.Props) {
  const t = useTranslations("core.global");

  return (
    <NumberFieldPrimitive.Decrement
      aria-label={t("decrease")}
      className={cn(stepperButtonClassName, "rounded-s-md", className)}
      data-slot="number-field-decrement"
      {...props}
    >
      {children ?? <MinusIcon />}
    </NumberFieldPrimitive.Decrement>
  );
}

function NumberFieldIncrement({
  children,
  className,
  ...props
}: NumberFieldPrimitive.Increment.Props) {
  const t = useTranslations("core.global");

  return (
    <NumberFieldPrimitive.Increment
      aria-label={t("increase")}
      className={cn(stepperButtonClassName, "rounded-e-md", className)}
      data-slot="number-field-increment"
      {...props}
    >
      {children ?? <PlusIcon />}
    </NumberFieldPrimitive.Increment>
  );
}

const ScrubCursorIcon = (props: React.ComponentProps<"svg">) => (
  <svg
    aria-hidden="true"
    fill="black"
    height="14"
    stroke="white"
    viewBox="0 0 26 14"
    width="26"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="M19.5 5.5L6.49737 5.51844V2L1 6.9999L6.5 12L6.49737 8.5L19.5 8.5V12L25 6.9999L19.5 2V5.5Z" />
  </svg>
);

function NumberFieldScrubArea({
  className,
  htmlFor,
  label,
  ...props
}: NumberFieldPrimitive.ScrubArea.Props & {
  htmlFor: string;
  label: React.ReactNode;
}) {
  return (
    <NumberFieldPrimitive.ScrubArea
      className={cn(
        "flex cursor-ew-resize touch-none select-none group-data-disabled/number-field:pointer-events-none group-data-disabled/number-field:opacity-50",
        className,
      )}
      data-slot="number-field-scrub-area"
      {...props}
    >
      <label
        className="cursor-ew-resize text-sm leading-none font-medium"
        htmlFor={htmlFor}
      >
        {label}
      </label>
      <NumberFieldPrimitive.ScrubAreaCursor
        className="drop-shadow-sm"
        data-slot="number-field-scrub-area-cursor"
      >
        <ScrubCursorIcon />
      </NumberFieldPrimitive.ScrubAreaCursor>
    </NumberFieldPrimitive.ScrubArea>
  );
}

export {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldScrubArea,
};
