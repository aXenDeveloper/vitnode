"use client";

import { Progress as ProgressPrimitive } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      className={cn(
        "bg-muted relative flex h-1.5 w-full items-center overflow-x-hidden rounded-full",
        className,
      )}
      data-slot="progress"
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="bg-primary size-full flex-1 transition-all"
        data-slot="progress-indicator"
        style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
