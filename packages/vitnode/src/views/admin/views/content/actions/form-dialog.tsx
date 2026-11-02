import React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import type { ContentFormSurface } from "../form/surface";

import { ContentFormSurfaceContext } from "../form/surface";

export const ContentFormDialog = ({
  children,
  description,
  form,
  onOpenChange,
  open,
  skeleton,
  surface = "dialog",
  title,
}: {
  children?: React.ReactElement;
  description: React.ReactNode;
  /** The form itself. Not rendered until the dialog opens. */
  form: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  skeleton: React.ReactNode;
  /** A centred `dialog` (the default) or a `sheet` from the right. */
  surface?: ContentFormSurface;
  title: React.ReactNode;
}) => (
  <Dialog onOpenChange={onOpenChange} open={open}>
    {children ? <DialogTrigger render={children} /> : null}

    <ContentFormSurfaceContext value={surface}>
      {surface === "sheet" ? (
        <SheetContent
          className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
          side="right"
        >
          <SheetHeader className="border-b pe-12">
            <SheetTitle className="text-balance">{title}</SheetTitle>
            <SheetDescription className="text-pretty">
              {description}
            </SheetDescription>
          </SheetHeader>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 pt-5 *:last:flex-1">
            <React.Suspense fallback={skeleton}>{form}</React.Suspense>
          </div>
        </SheetContent>
      ) : (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          <React.Suspense fallback={skeleton}>{form}</React.Suspense>
        </DialogContent>
      )}
    </ContentFormSurfaceContext>
  </Dialog>
);
