import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";
import { XIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

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
import { modalScrimClassName } from "./modal-scrim";

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

/**
 * The surrounding {@link Dialog}'s state: `open`, `setOpen`, and the unsaved-
 * changes flag (`isDirty`, `setIsDirty`) that forms inside it set.
 */
const useDialog = () => React.use(DialogContext);

const alwaysRestoreFocus = () => true;

/**
 * A Base UI modal dialog, controlled (`open`) or uncontrolled. While a form
 * inside it reports unsaved changes, closing asks for confirmation first;
 * clicks on a toast do not count as clicking outside.
 */
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

  const changeOpen = React.useCallback(
    (newOpen: boolean) => {
      onOpenChange?.(newOpen);
      setOpen(newOpen);
    },
    [onOpenChange],
  );

  const handleOpenChange = (
    newOpen: boolean,
    eventDetails: DialogPrimitive.Root.ChangeEventDetails,
  ) => {
    if (!newOpen) {
      if (isDirty) {
        eventDetails.cancel();
        setOpenAlertDialogBeforeClose(true);

        return;
      }

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
        <AlertDialogContent finalFocus={alwaysRestoreFocus}>
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
                changeOpen(false);
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

/** The element that opens the dialog. */
function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

/** An element that closes the dialog. */
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
        modalScrimClassName,
        "duration-200 data-ending-style:duration-150",
        className,
      )}
      data-slot="dialog-overlay"
      {...props}
    />
  );
}

/**
 * The dialog panel, rendered in a portal over a scrim. `showCloseButton`
 * (default `true`) adds an icon close button labelled with the translated
 * "Close".
 */
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
          "bg-popover text-popover-foreground ease-fluid fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 grid-cols-[minmax(0,1fr)] gap-4 rounded-xl border p-6 shadow-xl transition-[opacity,scale] duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none sm:max-w-lg starting:scale-95 starting:opacity-0",
          "max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain sm:max-h-[calc(100dvh-5rem)]",
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
              <Button
                aria-label={t("close")}
                className="pointer-coarse:size-10"
                size="icon-sm"
                variant="ghost"
              />
            }
          >
            <XIcon />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

/** Holds the title and description. */
function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      data-slot="dialog-header"
      {...props}
    />
  );
}

/**
 * Holds the dialog's actions. `showCloseButton` (default `false`) adds an
 * outline "Close" button.
 */
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
        "bg-muted/50 -mx-6 -mb-6 flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-end",
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

/** The dialog's accessible title. */
function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      className={cn(
        "font-heading text-lg leading-tight font-semibold text-balance",
        className,
      )}
      data-slot="dialog-title"
      {...props}
    />
  );
}

/** The dialog's accessible description. */
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
