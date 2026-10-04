import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "cn";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import React from "react";

import { MotionFeatures } from "@/components/motion-features";

const THUMB_SPRING = { type: "spring", duration: 0.3, bounce: 0 } as const;

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "default" | "sm";
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <MotionFeatures withLayoutAndDrag>
      <SwitchPrimitive.Root
        className={cn(
          "peer group/switch focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 relative inline-flex shrink-0 items-center justify-start rounded-full border border-transparent shadow-xs transition-[color,background-color,box-shadow] outline-none after:absolute after:-inset-x-3 after:-inset-y-3.5 focus-visible:ring-3 aria-invalid:ring-3 data-checked:justify-end data-disabled:cursor-not-allowed data-disabled:opacity-50 data-[size=default]:h-4.5 data-[size=default]:w-8 data-[size=sm]:h-3.5 data-[size=sm]:w-6",
          className,
        )}
        data-size={size}
        data-slot="switch"
        {...props}
      >
        <SwitchPrimitive.Thumb
          className="bg-background dark:bg-foreground pointer-events-none block rounded-full ring-0 transition-[width] duration-150 ease-out group-data-[size=default]/switch:h-4 group-data-[size=default]/switch:w-4 group-active/switch:not-data-disabled:group-data-[size=default]/switch:w-4.75 group-data-[size=sm]/switch:h-3 group-data-[size=sm]/switch:w-3 group-active/switch:not-data-disabled:group-data-[size=sm]/switch:w-3.5 motion-reduce:transition-none"
          data-slot="switch-thumb"
          render={
            <m.span
              layout
              transition={shouldReduceMotion ? { duration: 0 } : THUMB_SPRING}
            />
          }
        />
      </SwitchPrimitive.Root>
    </MotionFeatures>
  );
}

export { Switch };
