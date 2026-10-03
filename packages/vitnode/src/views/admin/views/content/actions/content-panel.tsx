import React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

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

      <React.Suspense
        fallback={
          <div className="flex items-center justify-center">
            <Spinner size="xl" />
          </div>
        }
      >
        {children}
      </React.Suspense>
    </DialogContent>
  </Dialog>
);
