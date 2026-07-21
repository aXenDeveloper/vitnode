"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import React from "react";

import { cn } from "@/lib/utils";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./alert-dialog";
import { Button } from "./button";

const DialogContext = React.createContext<{
  isDirty?: boolean;
  open: boolean;
  setIsDirty?: (value: boolean) => void;
  setOpen?: (value: boolean) => void;
  setOpenAlertDialogBeforeClose?: (value: boolean) => void;
}>({
  open: false,
  setOpen: () => {},
  isDirty: false,
  setOpenAlertDialogBeforeClose: () => {},
});

const useDialog = () => React.use(DialogContext);

function Dialog({
  onOpenChange,
  open: openProp,
  ...props
}: Omit<DialogPrimitive.Root.Props, "children" | "onOpenChange"> & {
  children?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations("core.global");
  const [open, setOpen] = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);
  const [openAlertDialogBeforeClose, setOpenAlertDialogBeforeClose] =
    React.useState(false);

  const isOpen = openProp ?? open;

  // Opens/closes the dialog programmatically, bypassing the unsaved-changes guard.
  const changeOpen = React.useCallback(
    (newOpen: boolean) => {
      onOpenChange?.(newOpen);
      setOpen(newOpen);
    },
    [onOpenChange],
  );

  // Wired to Base UI. Blocks dismissals while there are unsaved changes (asking
  // the user to confirm first) and ignores presses that land on a toast.
  const handleOpenChange = (
    newOpen: boolean,
    eventDetails: DialogPrimitive.Root.ChangeEventDetails,
  ) => {
    if (!newOpen) {
      // Prevent closing the dialog if there are unsaved changes.
      if (isDirty) {
        eventDetails.cancel();
        setOpenAlertDialogBeforeClose(true);

        return;
      }

      // Prevent dismissing the dialog when clicking on a toast.
      if (eventDetails.reason === "outside-press") {
        const target = eventDetails.event.target as Element | null;
        if (target?.closest("[data-sonner-toaster]")) {
          eventDetails.cancel();

          return;
        }
      }
    }

    changeOpen(newOpen);
  };

  const contextValue = React.useMemo(
    () => ({
      open: isOpen,
      setOpen: changeOpen,
      isDirty,
      setIsDirty,
      setOpenAlertDialogBeforeClose,
    }),
    [isOpen, changeOpen, isDirty],
  );

  return (
    <DialogContext value={contextValue}>
      <DialogPrimitive.Root
        data-slot="dialog"
        onOpenChange={handleOpenChange}
        open={isOpen}
        {...props}
      />

      <AlertDialog
        onOpenChange={setOpenAlertDialogBeforeClose}
        open={openAlertDialogBeforeClose}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("are_you_sure_want_to_leave_form.title")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("are_you_sure_want_to_leave_form.desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("are_you_sure_want_to_leave_form.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsDirty(false);
                setTimeout(() => changeOpen(false), 100);
              }}
            >
              {t("are_you_sure_want_to_leave_form.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DialogContext>
  );
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/50 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0",
        className,
      )}
      data-slot="dialog-overlay"
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
}) {
  const t = useTranslations("core.global");

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        className={cn(
          "dark:bg-background bg-card fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] grid-cols-[minmax(0,1fr)] gap-4 rounded-lg border p-6 shadow-lg transition-all duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 sm:max-w-lg",
          "max-h-[calc(100vh-2rem)] overflow-y-scroll sm:max-h-[calc(100vh-5rem)]",
          className,
        )}
        data-slot="dialog-content"
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            className="absolute end-4 top-4"
            data-slot="dialog-close"
            render={
              <Button aria-label={t("close")} size="icon-sm" variant="ghost" />
            }
          >
            <XIcon />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      data-slot="dialog-header"
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  const t = useTranslations("core.global");

  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className,
      )}
      data-slot="dialog-footer"
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close
          data-slot="dialog-close"
          render={<Button variant="outline">{t("close")}</Button>}
        />
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      className={cn("font-heading leading-none font-medium", className)}
      data-slot="dialog-title"
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      className={cn(
        "text-muted-foreground *:[a]:hover:text-foreground text-sm *:[a]:underline *:[a]:underline-offset-3",
        className,
      )}
      data-slot="dialog-description"
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  useDialog,
};
