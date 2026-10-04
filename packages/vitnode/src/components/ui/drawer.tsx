import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import { cn } from "cn";
import React from "react";

import { modalScrimClassName } from "@/components/ui/modal-scrim";

type DrawerDirection = "bottom" | "left" | "right" | "top";

const SWIPE_DIRECTION = {
  bottom: "down",
  left: "left",
  right: "right",
  top: "up",
} as const satisfies Record<
  DrawerDirection,
  DrawerPrimitive.Root.Props["swipeDirection"]
>;

const asChildProps = (
  asChild: boolean | undefined,
  children: React.ReactNode,
) =>
  asChild && React.isValidElement<Record<string, unknown>>(children)
    ? { render: children }
    : { children };

function Drawer({
  direction = "bottom",
  ...props
}: Omit<DrawerPrimitive.Root.Props, "swipeDirection"> & {
  direction?: DrawerDirection;
}) {
  return (
    <DrawerPrimitive.Root
      swipeDirection={SWIPE_DIRECTION[direction]}
      {...props}
    />
  );
}

function DrawerTrigger({
  asChild,
  children,
  ...props
}: DrawerPrimitive.Trigger.Props & { asChild?: boolean }) {
  return (
    <DrawerPrimitive.Trigger
      data-slot="drawer-trigger"
      {...props}
      {...asChildProps(asChild, children)}
    />
  );
}

function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose({
  asChild,
  children,
  ...props
}: DrawerPrimitive.Close.Props & { asChild?: boolean }) {
  return (
    <DrawerPrimitive.Close
      data-slot="drawer-close"
      {...props}
      {...asChildProps(asChild, children)}
    />
  );
}

function DrawerOverlay({
  className,
  ...props
}: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      className={cn(
        modalScrimClassName,
        "opacity-[calc(1-var(--drawer-swipe-progress,0))] duration-300 data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*200ms)] data-swiping:duration-0",
        className,
      )}
      data-slot="drawer-overlay"
      {...props}
    />
  );
}

function DrawerContent({
  className,
  children,
  ...props
}: DrawerPrimitive.Popup.Props) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Viewport className="fixed inset-0 z-50 flex">
        <DrawerPrimitive.Popup
          className={cn(
            "group/drawer-content bg-popover text-popover-foreground ease-fluid relative flex flex-col text-sm shadow-lg transition-[translate] duration-300 outline-none after:absolute after:bg-inherit data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*200ms)] data-swiping:duration-0 data-swiping:select-none motion-reduce:transition-none",
            "data-[swipe-direction=down]:max-h-4/5 data-[swipe-direction=down]:w-full data-[swipe-direction=down]:translate-y-[calc(var(--drawer-snap-point-offset,0px)+var(--drawer-swipe-movement-y,0px))] data-[swipe-direction=down]:self-end data-[swipe-direction=down]:rounded-t-xl data-[swipe-direction=down]:border-t data-[swipe-direction=down]:after:inset-x-0 data-[swipe-direction=down]:after:top-full data-[swipe-direction=down]:after:h-12 data-[swipe-direction=down]:data-ending-style:translate-y-full data-[swipe-direction=down]:data-starting-style:translate-y-full",
            "data-[swipe-direction=up]:max-h-4/5 data-[swipe-direction=up]:w-full data-[swipe-direction=up]:translate-y-(--drawer-swipe-movement-y) data-[swipe-direction=up]:self-start data-[swipe-direction=up]:rounded-b-xl data-[swipe-direction=up]:border-b data-[swipe-direction=up]:after:inset-x-0 data-[swipe-direction=up]:after:bottom-full data-[swipe-direction=up]:after:h-12 data-[swipe-direction=up]:data-ending-style:-translate-y-full data-[swipe-direction=up]:data-starting-style:-translate-y-full",
            "data-[swipe-direction=left]:mr-auto data-[swipe-direction=left]:h-full data-[swipe-direction=left]:w-3/4 data-[swipe-direction=left]:translate-x-(--drawer-swipe-movement-x) data-[swipe-direction=left]:rounded-r-xl data-[swipe-direction=left]:border-r data-[swipe-direction=left]:after:inset-y-0 data-[swipe-direction=left]:after:right-full data-[swipe-direction=left]:after:w-12 data-[swipe-direction=left]:data-ending-style:-translate-x-full data-[swipe-direction=left]:data-starting-style:-translate-x-full data-[swipe-direction=left]:sm:max-w-sm",
            "data-[swipe-direction=right]:ml-auto data-[swipe-direction=right]:h-full data-[swipe-direction=right]:w-3/4 data-[swipe-direction=right]:translate-x-(--drawer-swipe-movement-x) data-[swipe-direction=right]:rounded-l-xl data-[swipe-direction=right]:border-l data-[swipe-direction=right]:after:inset-y-0 data-[swipe-direction=right]:after:left-full data-[swipe-direction=right]:after:w-12 data-[swipe-direction=right]:data-ending-style:translate-x-full data-[swipe-direction=right]:data-starting-style:translate-x-full data-[swipe-direction=right]:sm:max-w-sm",
            className,
          )}
          data-slot="drawer-content"
          {...props}
        >
          <div
            aria-hidden="true"
            className="bg-muted mx-auto mt-4 hidden h-1.5 w-24 shrink-0 rounded-full group-data-[swipe-direction=down]/drawer-content:block"
          />
          {children}
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPortal>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 p-4 group-data-[swipe-direction=down]/drawer-content:text-center group-data-[swipe-direction=up]/drawer-content:text-center md:gap-1.5 md:text-start",
        className,
      )}
      data-slot="drawer-header"
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      data-slot="drawer-footer"
      {...props}
    />
  );
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      className={cn("text-foreground font-medium", className)}
      data-slot="drawer-title"
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="drawer-description"
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
};
