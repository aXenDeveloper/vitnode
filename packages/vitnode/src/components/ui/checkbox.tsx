import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { cn } from "cn";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import React from "react";

import { MotionFeatures } from "@/components/motion-features";

const checkPath = "M4 12l5 5 11-11";
const indeterminatePath = "M5 12h14";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  const shouldReduceMotion = useReducedMotion();
  const transition = shouldReduceMotion
    ? { duration: 0 }
    : ({ type: "spring", duration: 0.35, bounce: 0 } as const);

  return (
    <MotionFeatures>
      <CheckboxPrimitive.Root
        className={cn(
          "peer border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground dark:data-checked:bg-primary data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground dark:data-indeterminate:bg-primary relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border shadow-xs transition-shadow outline-none group-data-[disabled=true]/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-3 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-disabled:cursor-not-allowed data-disabled:opacity-50",
          className,
        )}
        data-slot="checkbox"
        {...props}
      >
        <CheckboxPrimitive.Indicator
          className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
          data-slot="checkbox-indicator"
          keepMounted
          render={(indicatorProps, { checked, indeterminate }) => (
            <span {...indicatorProps}>
              <m.svg
                aria-hidden="true"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <m.path
                  animate={{
                    opacity: indeterminate ? 1 : 0,
                    pathLength: indeterminate ? 1 : 0,
                  }}
                  d={indeterminatePath}
                  initial={false}
                  transition={transition}
                />
                <m.path
                  animate={{
                    opacity: checked && !indeterminate ? 1 : 0,
                    pathLength: checked && !indeterminate ? 1 : 0,
                  }}
                  d={checkPath}
                  initial={false}
                  transition={transition}
                />
              </m.svg>
            </span>
          )}
        />
      </CheckboxPrimitive.Root>
    </MotionFeatures>
  );
}

export { Checkbox };
