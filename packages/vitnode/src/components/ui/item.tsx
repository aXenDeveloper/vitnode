import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import React from "react";

import { Separator } from "@/components/ui/separator";

/** A list of {@link Item}s (`role="list"`). */
function ItemGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "group/item-group flex w-full flex-col gap-4 has-data-[size=sm]:gap-2.5 has-data-[size=xs]:gap-2",
        className,
      )}
      data-slot="item-group"
      role="list"
      {...props}
    />
  );
}

/** A divider between items. */
function ItemSeparator({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      className={className}
      data-slot="item-separator"
      orientation="horizontal"
      {...props}
    />
  );
}

const itemVariants = cva(
  "group/item flex w-full flex-wrap items-center rounded-md border text-sm transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 [a]:transition-colors [a]:hover:bg-muted [a]:active:bg-muted/80",
  {
    variants: {
      variant: {
        default: "border-transparent",
        outline: "border-border",
        muted: "border-transparent bg-muted/50",
      },
      size: {
        default: "gap-3.5 px-4 py-3.5",
        sm: "gap-2.5 px-3 py-2.5",
        xs: "gap-2 px-2.5 py-2 in-data-[slot=dropdown-menu-content]:p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/**
 * A row for one thing in a list, such as a setting, file or person; renders a
 * `div` (or your `render`, e.g. a link). `variant` is `"default"`, `"outline"`
 * or `"muted"`; `size` is `"default"`, `"sm"` or `"xs"`; both default to
 * `"default"`.
 */
function Item({
  className,
  variant = "default",
  size = "default",
  render,
  ...props
}: useRender.ComponentProps<"div"> & VariantProps<typeof itemVariants>) {
  return useRender({
    defaultTagName: "div",
    props: mergeProps<"div">(
      {
        className: cn(itemVariants({ variant, size, className })),
      },
      props,
    ),
    render,
    state: {
      slot: "item",
      variant,
      size,
    },
  });
}

const itemMediaVariants = cva(
  "flex shrink-0 items-center justify-center gap-2 group-has-data-[slot=item-description]/item:translate-y-0.5 group-has-data-[slot=item-description]/item:self-start [&_svg]:pointer-events-none",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        icon: "[&_svg:not([class*='size-'])]:size-4",
        tile: "bg-muted/60 text-muted-foreground ring-foreground/10 size-10 rounded-md ring-1 group-data-[size=sm]/item:size-8 group-data-[size=xs]/item:size-6 [&_svg:not([class*='size-'])]:size-4.5 group-data-[size=sm]/item:[&_svg:not([class*='size-'])]:size-4 group-data-[size=xs]/item:[&_svg:not([class*='size-'])]:size-3.5",
        image:
          "size-10 overflow-hidden rounded-sm group-data-[size=sm]/item:size-8 group-data-[size=xs]/item:size-6 [&_img]:size-full [&_img]:object-cover",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

/**
 * The item's leading icon or image. `variant` is `"default"`, `"icon"`,
 * `"tile"` (a muted square) or `"image"`; defaults to `"default"`.
 */
function ItemMedia({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof itemMediaVariants>) {
  return (
    <div
      className={cn(itemMediaVariants({ variant, className }))}
      data-slot="item-media"
      data-variant={variant}
      {...props}
    />
  );
}

/** Holds the title and description. */
function ItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-1 group-data-[size=xs]/item:gap-0 [&+[data-slot=item-content]]:flex-none",
        className,
      )}
      data-slot="item-content"
      {...props}
    />
  );
}

/** The item's main line. */
function ItemTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "line-clamp-1 flex w-fit items-center gap-2 text-sm leading-snug font-medium underline-offset-4",
        className,
      )}
      data-slot="item-title"
      {...props}
    />
  );
}

/** Secondary text under the title. */
function ItemDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "text-muted-foreground [&>a:hover]:text-primary line-clamp-2 text-start text-sm leading-normal font-normal group-data-[size=xs]/item:text-xs [&>a]:underline [&>a]:underline-offset-4",
        className,
      )}
      data-slot="item-description"
      {...props}
    />
  );
}

/** Buttons or controls at the item's end. */
function ItemActions({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      data-slot="item-actions"
      {...props}
    />
  );
}

/** A full-width line above the item's main row. */
function ItemHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex basis-full items-center justify-between gap-2",
        className,
      )}
      data-slot="item-header"
      {...props}
    />
  );
}

/** A full-width line below the item's main row. */
function ItemFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex basis-full items-center justify-between gap-2",
        className,
      )}
      data-slot="item-footer"
      {...props}
    />
  );
}

export {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemHeader,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
};
