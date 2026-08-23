"use client";

import { UploadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
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
import { Loader } from "@/components/ui/loader";

const UploadMyFilesForm = dynamic(async () =>
  import("./upload-files-form").then(mod => ({
    default: mod.UploadMyFilesForm,
  })),
);

export const UploadMyFiles = () => {
  const t = useTranslations("core.files.upload");

  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <UploadIcon />
        {t("trigger")}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <UploadMyFilesForm />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
