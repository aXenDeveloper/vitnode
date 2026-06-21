"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import * as React from "react";

import { cn } from "@/lib/utils";

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      className={cn("w-full", className)}
      data-slot="progress"
      value={value}
      {...props}
    >
      <ProgressPrimitive.Track
        className="bg-muted relative flex h-1.5 w-full items-center overflow-x-hidden rounded-full"
        data-slot="progress-track"
      >
        <ProgressPrimitive.Indicator
          className="bg-primary h-full transition-all"
          data-slot="progress-indicator"
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}

export { Progress };
