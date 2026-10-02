import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import * as React from "react";

const markerVariants = cva(
  "group/marker text-muted-foreground [a]:hover:text-foreground relative flex min-h-4 w-full items-center gap-2 text-start text-sm [&_svg:not([class*='size-'])]:size-4 [a]:underline [a]:underline-offset-3",
  {
    variants: {
      variant: {
        default: "",
        separator:
          "before:bg-border after:bg-border before:me-1 before:h-px before:min-w-0 before:flex-1 after:ms-1 after:h-px after:min-w-0 after:flex-1",
        border: "border-border border-b pb-2",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Marker({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof markerVariants>) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(markerVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "marker",
      variant,
    },
  });
}

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

export { Marker, MarkerContent, MarkerIcon, markerVariants };
