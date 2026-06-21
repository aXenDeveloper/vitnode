"use client";

import { UserPlusIcon } from "lucide-react";
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

const ContentCreateUserAdmin = dynamic(async () =>
  import("./content").then(module => ({
    default: module.ContentCreateUserAdmin,
  })),
);

export const CreateUserAdmin = () => {
  const t = useTranslations("admin.user.create");

  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <UserPlusIcon />
        {t("title")}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlusIcon className="size-5" />
            {t("title")}
          </DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <ContentCreateUserAdmin />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
