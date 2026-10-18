import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import { cn } from "cn";
import React from "react";

/** A thin divider line; `orientation` defaults to `horizontal`. */
function Separator({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive>) {
  return (
    <SeparatorPrimitive
      className={cn(
        "bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px data-[orientation=vertical]:self-center",
        className,
      )}
      data-slot="separator"
      orientation={orientation}
      {...props}
    />
  );
}

export { Separator };
