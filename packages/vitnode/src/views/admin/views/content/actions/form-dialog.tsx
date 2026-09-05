"use client";

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
  skeleton,
  title,
}: {
  /** The control that opens the dialog. */
  children: React.ReactElement;
  description: React.ReactNode;
  /** The form itself. Not rendered until the dialog opens. */
  form: React.ReactNode;
  skeleton: React.ReactNode;
  title: React.ReactNode;
}) => (
  <Dialog>
    <DialogTrigger render={children} />

    <DialogContent>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <React.Suspense fallback={skeleton}>{form}</React.Suspense>
    </DialogContent>
  </Dialog>
);
