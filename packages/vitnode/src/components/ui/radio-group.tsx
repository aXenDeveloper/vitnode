import type React from "react";

import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { cn } from "cn";

/** A group of radio buttons (Base UI `RadioGroup`) holding {@link RadioGroupItem}s. */
function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      className={cn("grid w-full gap-3", className)}
      data-slot="radio-group"
      {...props}
    />
  );
}

/** One radio button in a {@link RadioGroup}. */
function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioPrimitive.Root>) {
  return (
    <RadioPrimitive.Root
      className={cn(
        "group/radio-group-item peer border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary hover:not-data-checked:not-data-disabled:border-muted-foreground/60 relative flex aspect-square size-4 shrink-0 items-center justify-center rounded-full border shadow-xs outline-none after:absolute after:-inset-4 focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      data-slot="radio-group-item"
      {...props}
    >
      <RadioPrimitive.Indicator
        className="bg-primary size-2 rounded-full"
        data-slot="radio-group-indicator"
      />
    </RadioPrimitive.Root>
  );
}

export { RadioGroup, RadioGroupItem };
