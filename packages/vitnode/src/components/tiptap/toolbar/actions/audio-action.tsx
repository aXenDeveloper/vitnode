import { AudioLinesIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader } from "@/components/ui/loader";

const AudioForm = React.lazy(async () =>
  import("./audio/audio-form").then(module => ({
    default: module.AudioForm,
  })),
);

export const AudioDialog = ({
  open,
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const t = useTranslations("core.global.editor.audio");

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AudioLinesIcon className="size-5" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <AudioForm />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
