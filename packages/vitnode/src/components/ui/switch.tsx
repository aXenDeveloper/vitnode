import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "cn";
import React from "react";

/**
 * An on/off toggle (Base UI `Switch`) with an animated thumb. `size`:
 * `default` or `sm`.
 */
function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "default" | "sm";
}) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "peer group/switch focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 relative inline-flex shrink-0 items-center justify-start rounded-full border border-transparent shadow-xs transition-[color,background-color,box-shadow] outline-none after:absolute after:-inset-x-3 after:-inset-y-3.5 focus-visible:ring-3 aria-invalid:ring-3 data-disabled:cursor-not-allowed data-disabled:opacity-50 data-[size=default]:h-4.5 data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6",
        className,
      )}
      data-size={size}
      data-slot="switch"
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "bg-background dark:bg-foreground pointer-events-none block rounded-full ring-0",
          "ease-fluid transition-[translate,width] duration-200 motion-reduce:transition-none",
          "group-data-[size=default]/switch:size-4 group-active/switch:not-data-disabled:group-data-[size=default]/switch:w-4.75",
          "group-data-[size=default]/switch:data-checked:translate-x-3.5 group-active/switch:not-data-disabled:group-data-[size=default]/switch:data-checked:translate-x-2.75",
          "rtl:group-data-[size=default]/switch:data-checked:-translate-x-3.5 rtl:group-active/switch:not-data-disabled:group-data-[size=default]/switch:data-checked:-translate-x-2.75",
          "group-data-[size=sm]/switch:size-3 group-active/switch:not-data-disabled:group-data-[size=sm]/switch:w-3.5",
          "group-data-[size=sm]/switch:data-checked:translate-x-2.5 group-active/switch:not-data-disabled:group-data-[size=sm]/switch:data-checked:translate-x-2",
          "rtl:group-data-[size=sm]/switch:data-checked:-translate-x-2.5 rtl:group-active/switch:not-data-disabled:group-data-[size=sm]/switch:data-checked:-translate-x-2",
        )}
        data-slot="switch-thumb"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
