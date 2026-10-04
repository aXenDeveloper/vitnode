import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { cn } from "cn";
import React from "react";

function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      className={cn("grid w-full gap-3", className)}
      data-slot="radio-group"
      {...props}
    />
  );
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioPrimitive.Root>) {
  return (
    <RadioPrimitive.Root
      className={cn(
        "group/radio-group-item peer border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary relative flex aspect-square size-4 shrink-0 rounded-full border shadow-xs transition-[background-color,border-color,box-shadow,scale] duration-150 ease-out outline-none after:absolute after:-inset-4 focus-visible:ring-3 active:not-data-disabled:scale-90 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-disabled:cursor-not-allowed data-disabled:opacity-50 motion-reduce:transition-none",
        className,
      )}
      data-slot="radio-group-item"
      {...props}
    >
      <RadioPrimitive.Indicator
        className="absolute inset-0 flex items-center justify-center transition-[scale,opacity] duration-150 ease-out data-ending-style:scale-0 data-ending-style:opacity-0 data-starting-style:scale-0 data-starting-style:opacity-0 motion-reduce:transition-none"
        data-slot="radio-group-indicator"
      >
        <span className="bg-primary-foreground size-2 rounded-full" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  );
}

export { RadioGroup, RadioGroupItem };
