import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { cn } from "cn";
import React from "react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { modalScrimClassName } from "@/components/ui/modal-scrim";

const AlertDialogContext = React.createContext<{
  open: boolean;
  setOpen?: (value: boolean) => void;
}>({
  open: false,
  setOpen: () => {},
});

const useAlertDialog = () => React.use(AlertDialogContext);

function AlertDialog({
  onOpenChange,
  open: openProp,
  ...props
}: Omit<AlertDialogPrimitive.Root.Props, "onOpenChange"> & {
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const isOpen = openProp ?? open;

  const changeOpen = React.useCallback(
    (newOpen: boolean) => {
      onOpenChange?.(newOpen);
      setOpen(newOpen);
    },
    [onOpenChange],
  );

  const contextValue = React.useMemo(
    () => ({ open: isOpen, setOpen: changeOpen }),
    [changeOpen, isOpen],
  );

  return (
    <AlertDialogContext value={contextValue}>
      <AlertDialogPrimitive.Root
        data-slot="alert-dialog"
        onOpenChange={changeOpen}
        open={isOpen}
        {...props}
      />
    </AlertDialogContext>
  );
}

function AlertDialogTrigger({ ...props }: AlertDialogPrimitive.Trigger.Props) {
  return (
    <AlertDialogPrimitive.Trigger data-slot="alert-dialog-trigger" {...props} />
  );
}

function AlertDialogPortal({ ...props }: AlertDialogPrimitive.Portal.Props) {
  return (
    <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
  );
}

function AlertDialogOverlay({
  className,
  ...props
}: AlertDialogPrimitive.Backdrop.Props) {
  return (
    <AlertDialogPrimitive.Backdrop
      className={cn(
        modalScrimClassName,
        "duration-200 data-ending-style:duration-150",
        className,
      )}
      data-slot="alert-dialog-overlay"
      {...props}
    />
  );
}

function AlertDialogContent({
  className,
  size = "default",
  ...props
}: AlertDialogPrimitive.Popup.Props & {
  size?: "default" | "sm";
}) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Popup
        className={cn(
          "group/alert-dialog-content bg-popover text-popover-foreground ease-fluid fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border p-6 shadow-xl transition-[opacity,scale] duration-200 data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none data-[size=default]:sm:max-w-lg data-[size=sm]:sm:max-w-sm",
          className,
        )}
        data-size={size}
        data-slot="alert-dialog-content"
        {...props}
      />
    </AlertDialogPortal>
  );
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "grid grid-rows-[auto_1fr] gap-1.5 group-data-[size=sm]/alert-dialog-content:place-items-center group-data-[size=sm]/alert-dialog-content:text-center has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr] has-data-[slot=alert-dialog-media]:gap-x-6 sm:group-data-[size=default]/alert-dialog-content:has-data-[slot=alert-dialog-media]:grid-rows-[auto_1fr]",
        className,
      )}
      data-slot="alert-dialog-header"
      {...props}
    />
  );
}

function AlertDialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-muted/50 -mx-6 -mb-6 flex flex-col-reverse gap-2 rounded-b-xl border-t px-6 py-4 group-data-[size=sm]/alert-dialog-content:grid group-data-[size=sm]/alert-dialog-content:grid-cols-2 sm:flex-row sm:justify-end",
        className,
      )}
      data-slot="alert-dialog-footer"
      {...props}
    />
  );
}

function AlertDialogMedia({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-muted mb-2 inline-flex size-16 items-center justify-center rounded-lg group-data-[size=sm]/alert-dialog-content:size-12 sm:group-data-[size=default]/alert-dialog-content:row-span-2 *:[svg:not([class*='size-'])]:size-8 group-data-[size=sm]/alert-dialog-content:*:[svg:not([class*='size-'])]:size-6",
        className,
      )}
      data-slot="alert-dialog-media"
      {...props}
    />
  );
}

function AlertDialogTitle({
  className,
  ...props
}: AlertDialogPrimitive.Title.Props) {
  return (
    <AlertDialogPrimitive.Title
      className={cn(
        "font-heading text-lg leading-tight font-semibold text-balance sm:group-data-[size=default]/alert-dialog-content:group-has-data-[slot=alert-dialog-media]/alert-dialog-content:col-start-2",
        className,
      )}
      data-slot="alert-dialog-title"
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: AlertDialogPrimitive.Description.Props) {
  return (
    <AlertDialogPrimitive.Description
      className={cn(
        "text-muted-foreground *:[a]:hover:text-foreground text-sm text-balance md:text-pretty *:[a]:underline *:[a]:underline-offset-3",
        className,
      )}
      data-slot="alert-dialog-description"
      {...props}
    />
  );
}

type AlertDialogButtonSize = "default" | "lg" | "sm" | "xs";

function AlertDialogAction({
  children,
  className,
  variant = "default",
  size = "default",
  ...props
}: AlertDialogPrimitive.Close.Props &
  Pick<React.ComponentProps<typeof Button>, "variant"> & {
    size?: AlertDialogButtonSize;
  }) {
  const t = useTranslations("core.global");

  return (
    <AlertDialogPrimitive.Close
      className={cn(className)}
      data-slot="alert-dialog-action"
      render={<Button size={size} variant={variant} />}
      {...props}
    >
      {children ?? t("confirm")}
    </AlertDialogPrimitive.Close>
  );
}

function AlertDialogCancel({
  children,
  className,
  variant = "outline",
  size = "default",
  ...props
}: AlertDialogPrimitive.Close.Props &
  Pick<React.ComponentProps<typeof Button>, "variant"> & {
    size?: AlertDialogButtonSize;
  }) {
  const t = useTranslations("core.global");

  return (
    <AlertDialogPrimitive.Close
      className={cn(className)}
      data-slot="alert-dialog-cancel"
      render={<Button size={size} variant={variant} />}
      {...props}
    >
      {children ?? t("cancel")}
    </AlertDialogPrimitive.Close>
  );
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
  useAlertDialog,
};
