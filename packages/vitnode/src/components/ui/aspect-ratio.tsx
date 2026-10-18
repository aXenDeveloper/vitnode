import { cn } from "cn";
import React from "react";

/**
 * Keeps its content at a fixed width-to-height `ratio` (e.g. `16 / 9`);
 * defaults to `1`.
 */
function AspectRatio({
  ratio = 1,
  className,
  style,
  ...props
}: React.ComponentProps<"div"> & { ratio?: number }) {
  return (
    <div
      className={cn("relative aspect-(--ratio)", className)}
      data-slot="aspect-ratio"
      style={{ ...style, "--ratio": ratio } as React.CSSProperties}
      {...props}
    />
  );
}

export { AspectRatio };
