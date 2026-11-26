import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { cn } from "cn";
import { LogOutIcon, XIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "../confirm-action/confirm-action-alert-dialog";
import { Button } from "./button";
import { DialogStackContext, useDialogStack } from "./dialog-stack";
import {
  dialogFooterFrameClassName,
  dialogFrameClassName,
  dialogPopupMotionClassName,
  dialogScrimClassName,
  dialogStackClassName,
} from "./modal-scrim";

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

      <ConfirmActionAlertDialog
        description={t("are_you_sure_want_to_leave_form.desc")}
        finalFocus={alwaysRestoreFocus}
        icon={<LogOutIcon />}
        onOpenChange={setOpenAlertDialogBeforeClose}
        onSubmit={({ onClose }) => {
          setIsDirty(false);
          onClose();
          changeOpen(false);
        }}
        open={openAlertDialogBeforeClose}
        textSubmit={t("are_you_sure_want_to_leave_form.confirm")}
        title={t("are_you_sure_want_to_leave_form.title")}
      />
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
      className={cn(dialogScrimClassName, className)}
      data-slot="dialog-overlay"
      {...props}
    />
  );
}

/**
 * The dialog panel, rendered in a portal over a scrim. `showCloseButton`
 * (default `true`) adds an icon close button labelled with the translated
 * "Close". `overlayClassName` is merged into the scrim's classes.
 */
function DialogContent({
  className,
  children,
  overlayClassName,
  showCloseButton = true,
  style,
  ...props
}: DialogPrimitive.Popup.Props & {
  overlayClassName?: string;
  showCloseButton?: boolean;
}) {
  const t = useTranslations("core.global");
  const {
    initialFocus,
    observePopup,
    reportNested,
    style: stackStyle,
  } = useDialogStack();

  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Popup
        className={cn(
          dialogFrameClassName,
          dialogStackClassName,
          "fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-3rem)] -translate-x-1/2 -translate-y-1/2 grid-cols-[minmax(0,1fr)] gap-4 p-6 sm:max-w-lg",
          dialogPopupMotionClassName,
          "max-h-[calc(100dvh-3rem)] overflow-y-auto overscroll-contain sm:max-h-[calc(100dvh-6rem)]",
          className,
        )}
        data-slot="dialog-content"
        initialFocus={initialFocus}
        ref={observePopup}
        style={state => ({
          ...stackStyle,
          ...(typeof style === "function" ? style(state) : style),
        })}
        {...props}
      >
        <DialogStackContext value={reportNested}>{children}</DialogStackContext>
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
        dialogFooterFrameClassName,
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:[&>:first-child:not(:last-child)]:me-auto",
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
        "font-heading text-lg leading-tight font-semibold text-balance wrap-break-word",
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
