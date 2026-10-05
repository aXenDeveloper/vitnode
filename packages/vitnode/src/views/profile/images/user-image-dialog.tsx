import { CameraIcon } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipWithContent } from "@/components/ui/tooltip";

import type {
  UserImageDialogContentProps,
  UserImageDialogLabels,
} from "./user-image-dialog-content";

const UserImageDialogContent = React.lazy(async () =>
  import("./user-image-dialog-content").then(module => ({
    default: module.UserImageDialogContent,
  })),
);

const UserImageDialogSkeleton = () => (
  <div aria-hidden="true" className="flex flex-col gap-4">
    <Skeleton className="h-14 w-full rounded-md" />
    <Skeleton className="h-14 w-full rounded-md" />
    <Skeleton className="h-32 w-full rounded-xl" />
  </div>
);

export type { UserImageDialogLabels };

export interface UserImageDialogProps extends Omit<
  UserImageDialogContentProps,
  "labels"
> {
  labels: UserImageDialogLabels;
  size?: "icon" | "icon-sm";
}

export const UserImageDialog = ({
  canUpload,
  hasImage,
  labels,
  size = "icon-sm",
  ...content
}: UserImageDialogProps) => {
  if (!canUpload && !hasImage) return null;

  return (
    <Dialog>
      <TooltipWithContent text={labels.title}>
        <DialogTrigger
          render={
            <Button
              aria-label={labels.title}
              className="bg-card text-foreground hover:bg-muted dark:bg-card dark:hover:bg-muted border-border shadow-sm"
              size={size}
              variant="outline"
            />
          }
        >
          <CameraIcon />
        </DialogTrigger>
      </TooltipWithContent>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{labels.title}</DialogTitle>
          <DialogDescription>{labels.desc}</DialogDescription>
        </DialogHeader>

        <React.Suspense fallback={<UserImageDialogSkeleton />}>
          <UserImageDialogContent
            canUpload={canUpload}
            hasImage={hasImage}
            labels={labels}
            {...content}
          />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
