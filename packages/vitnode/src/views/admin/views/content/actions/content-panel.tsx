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

/**
 * What the row's overflow menu hands every panel behind it.
 *
 * The open state lives in the menu rather than in the panel: a menu item
 * unmounts with the menu the moment it is clicked, and a dialog rendered inside
 * one would go with it. The panel is mounted *beside* the menu instead and told
 * when to open.
 */
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
