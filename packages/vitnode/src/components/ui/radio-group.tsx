import { Radio as RadioPrimitive } from "@base-ui/react/radio";
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group";
import { cn } from "cn";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import React from "react";

import { MotionFeatures } from "@/components/motion-features";

const INDICATOR_SPRING = {
  type: "spring",
  stiffness: 600,
  damping: 38,
  mass: 0.5,
} as const;

const RadioGroupContext = React.createContext<{ indicatorId?: string }>({});

/**
 * A group of radio buttons (Base UI `RadioGroup`). The selected dot glides
 * between its {@link RadioGroupItem}s.
 */
function RadioGroup({
  className,
  children,
  ...props
}: RadioGroupPrimitive.Props) {
  const indicatorId = React.useId();
  const contextValue = React.useMemo(() => ({ indicatorId }), [indicatorId]);

  return (
    <RadioGroupPrimitive
      className={cn("grid w-full gap-3", className)}
      data-slot="radio-group"
      {...props}
    >
      <MotionFeatures withLayoutAndDrag>
        <RadioGroupContext.Provider value={contextValue}>
          {children}
        </RadioGroupContext.Provider>
      </MotionFeatures>
    </RadioGroupPrimitive>
  );
}

/** One radio button in a {@link RadioGroup}. */
function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioPrimitive.Root>) {
  const { indicatorId } = React.use(RadioGroupContext);
  const shouldReduceMotion = useReducedMotion();

  return (
    <RadioPrimitive.Root
      className={cn(
        "group/radio-group-item peer border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 aria-invalid:aria-checked:border-primary dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 data-checked:border-primary hover:not-data-checked:not-data-disabled:border-muted-foreground/60 relative flex aspect-square size-4 shrink-0 items-center justify-center rounded-full border shadow-xs transition-[border-color,box-shadow,scale] duration-200 ease-out outline-none after:absolute after:-inset-4 focus-visible:ring-3 active:not-data-disabled:scale-90 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-disabled:cursor-not-allowed data-disabled:opacity-50 motion-reduce:transition-none",
        className,
      )}
      data-slot="radio-group-item"
      {...props}
    >
      <RadioPrimitive.Indicator
        className="bg-primary size-2 rounded-full"
        data-slot="radio-group-indicator"
        render={
          <m.span
            layoutId={indicatorId}
            transition={shouldReduceMotion ? { duration: 0 } : INDICATOR_SPRING}
          />
        }
      />
    </RadioPrimitive.Root>
  );
}

export { RadioGroup, RadioGroupItem };
