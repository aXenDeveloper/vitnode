import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { cn } from "cn";
import React from "react";

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  side,
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  anchor,
  ...props
}: Pick<
  React.ComponentProps<typeof PopoverPrimitive.Positioner>,
  "align" | "alignOffset" | "anchor" | "side" | "sideOffset"
> &
  React.ComponentProps<typeof PopoverPrimitive.Popup>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="isolate z-50"
        side={side}
        sideOffset={sideOffset}
      >
        <PopoverPrimitive.Popup
          className={cn(
            "bg-popover text-popover-foreground ring-foreground/10 ease-fluid z-50 flex w-72 origin-(--transform-origin) flex-col gap-4 rounded-xl p-4 text-sm shadow-lg ring-1 outline-hidden transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:duration-100 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none",
            className,
          )}
          data-slot="popover-content"
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1 text-sm", className)}
      data-slot="popover-header"
      {...props}
    />
  );
}

function PopoverTitle({
  className,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Title>) {
  return (
    <PopoverPrimitive.Title
      className={cn("font-medium", className)}
      data-slot="popover-title"
      {...props}
    />
  );
}

function PopoverDescription({
  className,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Description>) {
  return (
    <PopoverPrimitive.Description
      className={cn("text-muted-foreground", className)}
      data-slot="popover-description"
      {...props}
    />
  );
}

export {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
};
