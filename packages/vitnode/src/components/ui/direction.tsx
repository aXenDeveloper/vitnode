"use client";

import {
  DirectionProvider as DirectionProviderPrimitive,
  useDirection,
} from "@base-ui/react/direction-provider";
import React from "react";

function DirectionProvider({
  dir,
  direction,
  children,
  ...props
}: Omit<
  React.ComponentProps<typeof DirectionProviderPrimitive>,
  "direction"
> & {
  dir?: "ltr" | "rtl";
  direction?: "ltr" | "rtl";
}) {
  return (
    <DirectionProviderPrimitive direction={direction ?? dir} {...props}>
      {children}
    </DirectionProviderPrimitive>
  );
}

export { DirectionProvider, useDirection };
