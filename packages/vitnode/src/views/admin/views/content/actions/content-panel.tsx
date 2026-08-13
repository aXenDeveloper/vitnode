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
  /**
   * Where focus lands when the panel closes.
   *
   * The menu item it was opened from no longer exists by then, so without this a
   * keyboard user is dropped at the top of the document instead of back on the
   * button they opened - the menu trigger of the row they were working in.
   */
  finalFocus?: React.RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

/**
 * The dialog every overflow row action opens.
 *
 * Header, description and lazy-loading fallback in one place, because the five
 * panels differ only in their body - and a per-panel copy of this is how one of
 * them ends up with a different close button or no loader at all.
 */
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
  /**
   * Widths only, in practice: a panel whose body is a table of before-and-after
   * values needs more room than one asking a yes-or-no question.
   */
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

      {/* Every body here is behind a `dynamic()`, so the fallback belongs to the
          shell rather than being repeated in each of them. */}
      <React.Suspense fallback={<Loader />}>{children}</React.Suspense>
    </DialogContent>
  </Dialog>
);
