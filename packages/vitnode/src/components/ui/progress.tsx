import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { cn } from "cn";
import { useReducedMotion } from "motion/react";
import * as m from "motion/react-m";
import React from "react";

import { MotionFeatures } from "@/components/motion-features";

const INDETERMINATE_SWEEP = {
  duration: 1.4,
  ease: "easeInOut",
  repeat: Infinity,
} as const;

const toFraction = (value: number, min: number, max: number) =>
  max === min ? 0 : Math.min(Math.max((value - min) / (max - min), 0), 1);

const IndeterminateSweep = () => {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className="bg-primary/40 size-full" />;
  }

  return (
    <MotionFeatures>
      <m.div
        animate={{ x: ["-100%", "300%"] }}
        className="bg-primary h-full w-1/3 rounded-full"
        initial={{ x: "-100%" }}
        transition={INDETERMINATE_SWEEP}
      />
    </MotionFeatures>
  );
};

function Progress({
  className,
  children,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const isIndeterminate = value === null || !Number.isFinite(value);

  return (
    <ProgressPrimitive.Root
      className={cn(
        "flex w-full flex-wrap items-center gap-x-3 gap-y-2",
        className,
      )}
      data-slot="progress"
      max={max}
      min={min}
      value={value}
      {...props}
    >
      {children}
      <ProgressPrimitive.Track
        className="bg-muted relative flex h-1.5 w-full basis-full items-center overflow-hidden rounded-full"
        data-slot="progress-track"
      >
        {isIndeterminate ? (
          <ProgressPrimitive.Indicator
            className="size-full rtl:-scale-x-100"
            data-slot="progress-indicator"
          >
            <IndeterminateSweep />
          </ProgressPrimitive.Indicator>
        ) : (
          <ProgressPrimitive.Indicator
            className="bg-primary ease-fluid h-full origin-left transition-transform duration-300 motion-reduce:transition-none rtl:origin-right"
            data-slot="progress-indicator"
            style={{
              width: "100%",
              transform: `scaleX(${toFraction(value, min, max)})`,
            }}
          />
        )}
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}

function ProgressLabel({
  className,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Label>) {
  return (
    <ProgressPrimitive.Label
      className={cn("text-sm font-medium", className)}
      data-slot="progress-label"
      {...props}
    />
  );
}

function ProgressValue({
  className,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Value>) {
  return (
    <ProgressPrimitive.Value
      className={cn(
        "text-muted-foreground ms-auto text-sm tabular-nums",
        className,
      )}
      data-slot="progress-value"
      {...props}
    />
  );
}

export { Progress, ProgressLabel, ProgressValue };
