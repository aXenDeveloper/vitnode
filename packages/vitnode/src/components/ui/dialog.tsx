'use client';

import { XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog as DialogPrimitive } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog';

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

export const useDialog = () => React.use(DialogContext);

function Dialog({
  onOpenChange,
  open: openProp,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  const t = useTranslations('core.global');
  const [open, setOpen] = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);
  const [openAlertDialogBeforeClose, setOpenAlertDialogBeforeClose] =
    React.useState(false);

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      onOpenChange?.(newOpen);
      setOpen(newOpen);
    },
    [onOpenChange],
  );

  const contextValue = React.useMemo(
    () => ({
      open: openProp ?? open,
      setOpen: handleOpenChange,
      isDirty,
      setIsDirty,
      setOpenAlertDialogBeforeClose,
    }),
    [openProp, open, handleOpenChange, isDirty],
  );

  return (
    <DialogContext value={contextValue}>
      <DialogPrimitive.Root
        data-slot="dialog"
        onOpenChange={handleOpenChange}
        open={openProp ?? open}
        {...props}
      />

      <AlertDialog
        onOpenChange={setOpenAlertDialogBeforeClose}
        open={openAlertDialogBeforeClose}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('are_you_sure_want_to_leave_form.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('are_you_sure_want_to_leave_form.desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('are_you_sure_want_to_leave_form.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setIsDirty(false);
                setTimeout(() => setOpen(false), 100);
              }}
            >
              {t('are_you_sure_want_to_leave_form.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DialogContext>
  );
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  const { setOpenAlertDialogBeforeClose, isDirty } = useDialog();

  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      onClick={e => {
        props?.onClick?.(e);
        // Prevent closing the dialog if there are unsaved changes
        if (isDirty) {
          e.preventDefault();
          setOpenAlertDialogBeforeClose?.(true);

          return;
        }
      }}
      {...props}
    />
  );
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50',
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
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  const { isDirty, setOpenAlertDialogBeforeClose } = useDialog();

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'dark:bg-background bg-card data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed left-[50%] top-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg',
          'max-h-[calc(100vh_-_2rem)] overflow-y-scroll sm:max-h-[calc(100vh_-_5rem)]',
          className,
        )}
        data-slot="dialog-content"
        onInteractOutside={e => {
          // Prevent dismissing the dialog when clicking on a toast
          const isToastItem = (e.target as Element)?.closest(
            '[data-sonner-toaster]',
          );
          if (isToastItem || isDirty) e.preventDefault();

          if (props?.onInteractOutside) {
            props.onInteractOutside(e);
          }
        }}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground rounded-xs focus:outline-hidden absolute right-4 top-4 opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0"
            data-slot="dialog-close"
            onClick={e => {
              if (isDirty) {
                e.preventDefault();
                setOpenAlertDialogBeforeClose?.(true);

                return;
              }
            }}
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-col gap-2 text-center sm:text-left', className)}
      data-slot="dialog-header"
      {...props}
    />
  );
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        className,
      )}
      data-slot="dialog-footer"
      {...props}
    />
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      className={cn('text-lg font-semibold leading-none', className)}
      data-slot="dialog-title"
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      className={cn('text-muted-foreground text-sm', className)}
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
};
