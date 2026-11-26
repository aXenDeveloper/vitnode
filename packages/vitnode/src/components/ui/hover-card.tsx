import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";
import { cn } from "cn";
import React from "react";

/**
 * Connects one `HoverCard` to triggers rendered anywhere else in the tree, so
 * a list of many triggers shares a single card instead of mounting one per
 * item. Pass it to the card's `handle` and to every `HoverCardTrigger` that
 * opens it; each trigger's `payload` reaches the card's render-function
 * children. Its `open(triggerId)` and `close()` methods only work while that
 * card is mounted.
 */
type HoverCardHandle<Payload> = PreviewCardPrimitive.Handle<Payload>;

/**
 * Creates a `HoverCardHandle`. Type the payload the triggers send with the
 * type argument.
 *
 * @example
 * ```tsx
 * import {
 *   createHoverCardHandle,
 *   HoverCard,
 *   HoverCardContent,
 *   HoverCardTrigger,
 * } from "@vitnode/core/components/ui/hover-card";
 *
 * const tagCard = createHoverCardHandle<{ tag: string }>();
 *
 * <HoverCardTrigger handle={tagCard} href="/tags/react" payload={{ tag: "react" }}>
 *   #react
 * </HoverCardTrigger>;
 *
 * <HoverCard handle={tagCard}>
 *   {({ payload }) => <HoverCardContent>{payload?.tag}</HoverCardContent>}
 * </HoverCard>;
 * ```
 */
const createHoverCardHandle = <Payload,>(): HoverCardHandle<Payload> =>
  PreviewCardPrimitive.createHandle<Payload>();

/**
 * A Base UI preview card that opens while its trigger is hovered or focused.
 * With a `handle` it also opens from detached triggers, and its children may
 * be a function of the active trigger's `payload`.
 */
function HoverCard<Payload>(props: PreviewCardPrimitive.Root.Props<Payload>) {
  return <PreviewCardPrimitive.Root data-slot="hover-card" {...props} />;
}

/**
 * The element that opens the card. Inside a `HoverCard` it needs no `handle`;
 * outside one, pass the card's `handle` and the `payload` it should render.
 */
function HoverCardTrigger<Payload>(
  props: PreviewCardPrimitive.Trigger.Props<Payload> &
    React.RefAttributes<HTMLElement>,
) {
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
        className="ease-fluid isolate z-50 h-(--positioner-height,auto) w-(--positioner-width,auto) has-data-transitioning:transition-[top,right,bottom,left] has-data-transitioning:duration-200 motion-reduce:transition-none"
        side={side}
        sideOffset={sideOffset}
      >
        <PreviewCardPrimitive.Popup
          className={cn(
            "bg-popover/90 text-popover-foreground ring-foreground/10 ease-fluid z-50 h-(--popup-height,auto) w-64 origin-(--transform-origin) rounded-xl p-4 text-sm shadow-lg ring-1 outline-hidden backdrop-blur-sm transition-[opacity,scale,translate,height] duration-200 will-change-[opacity,scale,translate] data-ending-style:scale-98 data-ending-style:opacity-0 data-ending-style:duration-120 data-ending-style:ease-in data-starting-style:scale-96 data-starting-style:opacity-0 data-[side=bottom]:data-ending-style:-translate-y-0.5 data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=left]:data-ending-style:translate-x-0.5 data-[side=left]:data-starting-style:translate-x-1 data-[side=right]:data-ending-style:-translate-x-0.5 data-[side=right]:data-starting-style:-translate-x-1 data-[side=top]:data-ending-style:translate-y-0.5 data-[side=top]:data-starting-style:translate-y-1 motion-reduce:transition-none",
            className,
          )}
          data-slot="hover-card-content"
          {...props}
        />
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  );
}

/**
 * Wraps the content of a card shared by several triggers so switching between
 * them cross-fades the old content into the new one, nudged from the side the
 * new trigger sits on, while the card glides to it and eases to the new
 * height. Without it the content swaps instantly. Motion is skipped under
 * `prefers-reduced-motion`.
 */
function HoverCardViewport({
  className,
  ...props
}: React.ComponentProps<typeof PreviewCardPrimitive.Viewport>) {
  return (
    <PreviewCardPrimitive.Viewport
      className={cn(
        "*:ease-fluid relative *:transition-[opacity,translate] *:duration-200 *:data-ending-style:opacity-0 *:data-ending-style:duration-150 *:data-previous:start-0 *:data-previous:top-0 *:data-previous:w-(--popup-width) *:data-starting-style:opacity-0 data-[activation-direction~=down]:*:data-ending-style:-translate-y-2 data-[activation-direction~=down]:*:data-starting-style:translate-y-2 data-[activation-direction~=left]:*:data-ending-style:translate-x-2 data-[activation-direction~=left]:*:data-starting-style:-translate-x-2 data-[activation-direction~=right]:*:data-ending-style:-translate-x-2 data-[activation-direction~=right]:*:data-starting-style:translate-x-2 data-[activation-direction~=up]:*:data-ending-style:translate-y-2 data-[activation-direction~=up]:*:data-starting-style:-translate-y-2 motion-reduce:*:transition-none",
        className,
      )}
      data-slot="hover-card-viewport"
      {...props}
    />
  );
}

export type { HoverCardHandle };
export {
  createHoverCardHandle,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  HoverCardViewport,
};
