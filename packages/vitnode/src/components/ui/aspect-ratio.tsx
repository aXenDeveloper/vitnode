import React from "react";

function AspectRatio({
  ratio = 1,
  style,
  ...props
}: React.ComponentProps<"div"> & {
  ratio?: number;
}) {
  return (
    <div
      data-slot="aspect-ratio"
      style={{ ...style, aspectRatio: ratio }}
      {...props}
    />
  );
}

export { AspectRatio };
