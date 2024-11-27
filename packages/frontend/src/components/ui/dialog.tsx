'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import React from 'react';

import { cn } from '../../helpers/classnames';

interface DialogContextArgs {
  isDirty?: boolean;
  open?: boolean;
  setIsDirty?: (value: boolean) => void;
  setOpen?: (value: boolean) => void;
}

export const DialogContext = React.createContext<DialogContextArgs>({
  open: false,
  isDirty: false,
});

export const useDialog = () => React.useContext(DialogContext);

const Dialog = ({
  children,
  onOpenChange,
  open: openProp,
  ...props
}: DialogPrimitive.DialogProps) => {
  const [open, setOpen] = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);

  return (
    <DialogContext.Provider
      value={{
        open: openProp ?? open,
        setOpen: val => {
          setIsDirty(false);
          onOpenChange?.(val);
          setOpen(val);
        },
        isDirty,
        setIsDirty,
      }}
    >
      <DialogPrimitive.Root
        onOpenChange={onOpenChange ?? setOpen}
        open={openProp ?? open}
        {...props}
      >
        {children}
      </DialogPrimitive.Root>
    </DialogContext.Provider>
  );
};

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = ({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) => (
  <DialogPrimitive.Overlay
    className={cn(
      'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/80',
      className,
    )}
    {...props}
  />
);

const DialogContent = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) => {
  const t = useTranslations('core.global');
  const { isDirty, setOpen } = useDialog();

  const handleBeforeUnload = (
    e:
      | CustomEvent<{
          originalEvent: PointerEvent;
        }>
      | React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (!isDirty) return;
    e.preventDefault();
    if (confirm(t('are_you_sure_want_to_leave_form'))) {
      setOpen?.(false);
    }
  };

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'bg-card data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed left-[50%] top-[50%] z-50 grid max-h-[calc(100vh-2rem)] w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto border p-6 shadow-lg duration-200 sm:rounded-lg md:max-h-[calc(100vh-4rem)] md:w-full',
          className,
        )}
        onPointerDownOutside={handleBeforeUnload}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none"
          onClick={handleBeforeUnload}
        >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
};

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col space-y-1.5 text-center sm:text-left',
      className,
    )}
    {...props}
  />
);

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex w-full flex-col-reverse sm:flex-row sm:space-x-2',
      className,
    )}
    {...props}
  />
);

const DialogTitle = ({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) => (
  <DialogPrimitive.Title
    className={cn(
      'text-lg font-semibold leading-none tracking-tight',
      className,
    )}
    {...props}
  />
);

const DialogDescription = ({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) => (
  <DialogPrimitive.Description
    className={cn('text-muted-foreground text-sm', className)}
    {...props}
  />
);

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
