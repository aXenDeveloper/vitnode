import type { VariantProps } from "class-variance-authority";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "cn";
import * as React from "react";

import { markerVariants } from "./marker-variants";

/**
 * A short inline note row, e.g. "Edited" or a divider label in a feed.
 *
 * `variant`: `default`, `separator` (lines either side) or `border` (bottom
 * border); defaults to `default`. `tone`: `neutral` (default), `info`,
 * `success`, `warning` or `destructive`. Pass `render` to swap the element.
 */
function Marker({
  className,
  variant = "default",
  tone = "neutral",
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof markerVariants>) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(markerVariants({ variant, tone }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "marker",
      variant,
      tone,
    },
  });
}

/** The leading icon of a {@link Marker}, sized to `size-4`. */
function MarkerIcon({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "size-4 shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      data-slot="marker-icon"
      {...props}
    />
  );
}

/** The text of a {@link Marker}; links inside it are underlined. */
function MarkerContent({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "*:[a]:hover:text-foreground min-w-0 wrap-break-word group-data-[variant=separator]/marker:flex-none group-data-[variant=separator]/marker:text-center *:[a]:underline *:[a]:underline-offset-3",
        className,
      )}
      data-slot="marker-content"
      {...props}
    />
  );
}

export { Marker, MarkerContent, MarkerIcon };
