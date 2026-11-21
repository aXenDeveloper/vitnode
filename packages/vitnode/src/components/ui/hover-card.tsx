import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";
import { cn } from "cn";
import React from "react";

/** A Base UI preview card that opens while its trigger is hovered or focused. */
function HoverCard({
  ...props
}: React.ComponentProps<typeof PreviewCardPrimitive.Root>) {
  return <PreviewCardPrimitive.Root data-slot="hover-card" {...props} />;
}

/** The element that opens the card. */
function HoverCardTrigger({
  ...props
}: React.ComponentProps<typeof PreviewCardPrimitive.Trigger>) {
  return (
    <PreviewCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />
  );
}

/**
 * The card popup, rendered in a portal; centered against the trigger by
 * default.
 */
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
            "bg-popover/90 text-popover-foreground ring-foreground/10 ease-fluid z-50 w-64 origin-(--transform-origin) rounded-xl p-4 text-sm shadow-lg ring-1 outline-hidden backdrop-blur-sm transition-[opacity,scale,translate] duration-200 will-change-[opacity,scale,translate] data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-120 data-ending-style:ease-in data-starting-style:scale-96 data-starting-style:opacity-0 data-[side=bottom]:data-ending-style:-translate-y-0.5 data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=left]:data-ending-style:translate-x-0.5 data-[side=left]:data-starting-style:translate-x-1 data-[side=right]:data-ending-style:-translate-x-0.5 data-[side=right]:data-starting-style:-translate-x-1 data-[side=top]:data-ending-style:translate-y-0.5 data-[side=top]:data-starting-style:translate-y-1 motion-reduce:transition-none",
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
