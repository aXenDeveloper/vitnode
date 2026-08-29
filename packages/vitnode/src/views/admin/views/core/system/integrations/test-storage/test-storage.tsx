"use client";

import { HardDriveIcon } from "lucide-react";
import React from "react";
import { useTranslations } from "use-intl";

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

const ContentTestStorage = React.lazy(async () =>
  import("./content").then(module => ({
    default: module.ContentTestStorage,
  })),
);

export const TestStorageAction = () => {
  const t = useTranslations("admin.system.integrations.storage.test");

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <HardDriveIcon />
        {t("label")}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDriveIcon className="size-5" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <ContentTestStorage />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
