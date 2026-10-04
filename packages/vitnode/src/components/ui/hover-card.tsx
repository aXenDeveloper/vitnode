import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";
import { cn } from "cn";
import React from "react";

function HoverCard({
  ...props
}: React.ComponentProps<typeof PreviewCardPrimitive.Root>) {
  return <PreviewCardPrimitive.Root data-slot="hover-card" {...props} />;
}

function HoverCardTrigger({
  ...props
}: React.ComponentProps<typeof PreviewCardPrimitive.Trigger>) {
  return (
    <PreviewCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />
  );
}

function HoverCardContent({
  className,
  side,
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  anchor,
  ...props
}: Pick<
  React.ComponentProps<typeof PreviewCardPrimitive.Positioner>,
  "align" | "alignOffset" | "anchor" | "side" | "sideOffset"
> &
  React.ComponentProps<typeof PreviewCardPrimitive.Popup>) {
  return (
    <PreviewCardPrimitive.Portal>
      <PreviewCardPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        anchor={anchor}
        className="isolate z-50"
        side={side}
        sideOffset={sideOffset}
      >
        <PreviewCardPrimitive.Popup
          className={cn(
            "bg-popover text-popover-foreground ring-foreground/10 ease-fluid z-50 w-64 origin-(--transform-origin) rounded-xl p-4 text-sm shadow-lg ring-1 outline-hidden transition-[opacity,scale] duration-150 data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:duration-100 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none",
            className,
          )}
          data-slot="hover-card-content"
          {...props}
        />
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  );
}

export { HoverCard, HoverCardContent, HoverCardTrigger };
