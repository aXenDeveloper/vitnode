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

/**
 * A Base UI drawer that slides in from an edge and can be swiped closed.
 * `direction` is `"bottom"` (default), `"top"`, `"left"` or `"right"`.
 */
function Drawer({
  direction = "bottom",
  indent = direction === "bottom",
  ...props
}: Omit<DrawerPrimitive.Root.Props, "swipeDirection"> & {
  direction?: DrawerDirection;
  /**
   * Shrinks the page behind the drawer while it is open, following the
   * swipe, like an iOS sheet. Needs a `DrawerIndent` around the page (the
   * public theme layout has one); without it nothing changes. Defaults to
   * `true` for bottom drawers and `false` for the other directions.
   */
  indent?: boolean;
}) {
  const root = (
    <DrawerPrimitive.Root
      swipeDirection={SWIPE_DIRECTION[direction]}
      {...props}
    />
  );

  return indent ? (
    root
  ) : (
    <DrawerPrimitive.Provider>{root}</DrawerPrimitive.Provider>
  );
}

interface IndentViewport {
  bottom: number;
  top: number;
}

const IndentedPage = ({
  active,
  children,
  style,
  ...props
}: React.ComponentProps<"div"> & { active: boolean }) => {
  const [wasActive, setWasActive] = React.useState(active);
  const [viewport, setViewport] = React.useState<IndentViewport | null>(null);

  if (active !== wasActive) {
    setWasActive(active);
    if (active) {
      setViewport({
        bottom: window.scrollY + window.innerHeight,
        top: window.scrollY,
      });
    }
  }

  return (
    <div
      {...props}
      style={
        viewport
          ? ({
              ...style,
              "--page-indent-bottom": `${viewport.bottom}px`,
              "--page-indent-top": `${viewport.top}px`,
            } as React.CSSProperties)
          : style
      }
    >
      <span
        aria-hidden="true"
        className="ease-fluid pointer-events-none absolute inset-x-0 top-[var(--page-indent-top,0px)] z-40 h-3 bg-[radial-gradient(circle_at_100%_100%,transparent_12px,black_12.5px),radial-gradient(circle_at_0_100%,transparent_12px,black_12.5px)] bg-size-[12px_12px] bg-position-[left_top,right_top] bg-no-repeat opacity-0 transition-opacity duration-200 group-data-active/indent:duration-300 motion-safe:group-data-active/indent:opacity-100"
      />
      {children}
    </div>
  );
};

/**
 * Wraps the page so bottom drawers (and any drawer with `indent`) shrink it behind
 * them: the page scales down around the visible screen, gets rounded top
 * corners over a black backdrop and grows back as the drawer is swiped away.
 * Fixed elements inside the page are positioned against the scaled page
 * while it is indented; pin them to `--page-indent-bottom` /
 * `--page-indent-top` under `group-data-active/indent:` (see the mobile tab
 * bar). Skipped under reduced motion. Universal.
 */
function DrawerIndent({ children }: { children: React.ReactNode }) {
  return (
    <DrawerPrimitive.Provider>
      <DrawerPrimitive.IndentBackground className="ease-fluid pointer-events-none fixed inset-0 bg-black opacity-0 transition-opacity duration-200 data-active:duration-300 motion-safe:data-active:opacity-100" />
      <DrawerPrimitive.Indent
        className="group/indent ease-fluid bg-background relative min-h-dvh origin-[50%_var(--page-indent-top,0px)] transition-[scale,translate] duration-200 data-active:duration-300 motion-safe:data-active:translate-y-[calc((1-var(--drawer-swipe-progress))*(env(safe-area-inset-top)+12px))] motion-safe:data-active:scale-[calc(0.94+0.06*var(--drawer-swipe-progress))] [:root:has([data-swiping])_&]:duration-0"
        render={(props, state) => (
          <IndentedPage {...props} active={state.active} />
        )}
      >
        {children}
      </DrawerPrimitive.Indent>
    </DrawerPrimitive.Provider>
  );
}

/**
 * The element that opens the drawer. `asChild` renders your child element as
 * the trigger instead of a button.
 */
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

/**
 * An element that closes the drawer. `asChild` renders your child element
 * instead of a button.
 */
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

/**
 * The drawer panel, rendered in a portal over a scrim, with a decorative drag
 * handle on bottom drawers.
 */
function DrawerContent({
  className,
  children,
  handle = true,
  ...props
}: DrawerPrimitive.Popup.Props & {
  /**
   * Renders the drag handle row above `children` on bottom drawers. Turn it
   * off to let content such as a cover image reach the top edge and draw your
   * own handle over it. Defaults to `true`.
   */
  handle?: boolean;
}) {
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
          {handle ? (
            <div
              aria-hidden="true"
              className="bg-muted mx-auto mt-4 hidden h-1.5 w-24 shrink-0 rounded-full group-data-[swipe-direction=down]/drawer-content:block"
            />
          ) : null}
          {children}
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPortal>
  );
}

/** Holds the title and description. */
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

/** Holds the drawer's actions. */
function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      data-slot="drawer-footer"
      {...props}
    />
  );
}

/** The drawer's accessible title. */
function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      className={cn("text-foreground font-medium", className)}
      data-slot="drawer-title"
      {...props}
    />
  );
}

/** The drawer's accessible description. */
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
  DrawerIndent,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
};
