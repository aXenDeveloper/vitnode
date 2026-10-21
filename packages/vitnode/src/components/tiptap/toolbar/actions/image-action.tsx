import { ImageIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

const ImageDialogContent = React.lazy(async () =>
  import("./image/image-dialog-content").then(module => ({
    default: module.ImageDialogContent,
  })),
);

export const ImageDialog = ({
  open,
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const t = useTranslations("core.global.editor.image");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="size-5" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>

        <React.Suspense
          fallback={
            <div className="flex items-center justify-center">
              <Spinner size="xl" />
            </div>
          }
        >
          <ImageDialogContent />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
