import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";
import { XIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { modalScrimClassName } from "@/components/ui/modal-scrim";

/**
 * A panel that slides in from a screen edge (Base UI `Dialog`). Use it for
 * short settings; see `AutoFormSheetFooter` for a form footer.
 */
function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

/** The element that opens the {@link Sheet}. */
function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

/** A control that closes the {@link Sheet}. */
function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      className={cn(
        modalScrimClassName,
        "duration-300 data-ending-style:duration-200",
        className,
      )}
      data-slot="sheet-overlay"
      {...props}
    />
  );
}

/**
 * The sheet's panel with a backdrop, floating as a rounded card inset from the
 * screen edges. `side`: `right` (default), `left`, `top` or `bottom`.
 * `showCloseButton` (default `true`) adds a close button with a translated
 * label; `keepMounted` keeps it in the DOM while closed.
 */
function SheetContent({
  className,
  children,
  keepMounted,
  side = "right",
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  keepMounted?: boolean;
  showCloseButton?: boolean;
  side?: "bottom" | "left" | "right" | "top";
}) {
  const t = useTranslations("core.global");

  return (
    <SheetPortal keepMounted={keepMounted}>
      <SheetOverlay />
      <SheetPrimitive.Popup
        className={cn(
          "bg-popover text-popover-foreground ease-fluid fixed z-50 flex flex-col gap-4 overflow-hidden rounded-xl border bg-clip-padding text-sm shadow-xl transition-[translate] duration-300 data-ending-style:duration-200 motion-reduce:transition-none",
          "data-[side=bottom]:inset-x-3 data-[side=bottom]:bottom-3 data-[side=bottom]:max-h-[calc(100dvh-(--spacing(6)))] data-[side=bottom]:data-ending-style:translate-y-[calc(100%+--spacing(3))] data-[side=bottom]:data-starting-style:translate-y-[calc(100%+--spacing(3))]",
          "data-[side=top]:inset-x-3 data-[side=top]:top-3 data-[side=top]:max-h-[calc(100dvh-(--spacing(6)))] data-[side=top]:data-ending-style:-translate-y-[calc(100%+--spacing(3))] data-[side=top]:data-starting-style:-translate-y-[calc(100%+--spacing(3))]",
          "data-[side=left]:inset-y-3 data-[side=left]:left-3 data-[side=left]:w-3/4 data-[side=left]:max-w-[calc(100%-(--spacing(6)))] data-[side=left]:data-ending-style:-translate-x-[calc(100%+--spacing(3))] data-[side=left]:data-starting-style:-translate-x-[calc(100%+--spacing(3))] data-[side=left]:sm:max-w-sm",
          "data-[side=right]:inset-y-3 data-[side=right]:right-3 data-[side=right]:w-3/4 data-[side=right]:max-w-[calc(100%-(--spacing(6)))] data-[side=right]:data-ending-style:translate-x-[calc(100%+--spacing(3))] data-[side=right]:data-starting-style:translate-x-[calc(100%+--spacing(3))] data-[side=right]:sm:max-w-sm",
          className,
        )}
        data-side={side}
        data-slot="sheet-content"
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            className="absolute end-4 top-4"
            data-slot="sheet-close"
            render={
              <Button
                aria-label={t("close")}
                className="pointer-coarse:size-10"
                size="icon-sm"
                variant="ghost"
              />
            }
          >
            <XIcon />
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
}

/** The top area for the title and description, divided from the body. */
function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 border-b p-4 pe-14", className)}
      data-slot="sheet-header"
      {...props}
    />
  );
}

/**
 * The bottom area for actions, pinned to the end of the sheet and divided from
 * the body. Buttons stack on phones and sit in a row, right-aligned, from `sm`.
 */
function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mt-auto flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end",
        className,
      )}
      data-slot="sheet-footer"
      {...props}
    />
  );
}

/** The sheet's accessible title. */
function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      className={cn("text-foreground font-medium", className)}
      data-slot="sheet-title"
      {...props}
    />
  );
}

/** The sheet's accessible description, muted. */
function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="sheet-description"
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
};
