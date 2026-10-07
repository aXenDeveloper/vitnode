import React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const ContentFormDialog = ({
  children,
  description,
  form,
  onOpenChange,
  open,
  skeleton,
  title,
}: {
  /** The control that opens the dialog. Absent when `open` drives it. */
  children?: React.ReactElement;
  description: React.ReactNode;
  /** The form itself. Not rendered until the dialog opens. */
  form: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  skeleton: React.ReactNode;
  title: React.ReactNode;
}) => (
  <Dialog onOpenChange={onOpenChange} open={open}>
    {children ? <DialogTrigger render={children} /> : null}

    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <React.Suspense fallback={skeleton}>{form}</React.Suspense>
    </DialogContent>
  </Dialog>
);
