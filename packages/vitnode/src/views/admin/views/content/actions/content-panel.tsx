"use client";

import React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader } from "@/components/ui/loader";

export interface ContentPanelProps {
  finalFocus?: React.RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export const ContentPanel = ({
  children,
  className,
  description,
  finalFocus,
  onOpenChange,
  open,
  title,
}: ContentPanelProps & {
  children: React.ReactNode;
  className?: string;
  description: React.ReactNode;
  title: React.ReactNode;
}) => (
  <Dialog onOpenChange={onOpenChange} open={open}>
    <DialogContent className={className} finalFocus={finalFocus}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>

      <React.Suspense fallback={<Loader />}>{children}</React.Suspense>
    </DialogContent>
  </Dialog>
);
