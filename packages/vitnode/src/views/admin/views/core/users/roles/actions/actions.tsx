"use client";

import { PlusIcon } from "lucide-react";
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

const CreateEditRoleAdmin = dynamic(async () =>
  import("./create-edit/create-edit").then(mod => ({
    default: mod.CreateEditRoleAdmin,
  })),
);

export const ActionsRolesAdmin = () => {
  const t = useTranslations("admin.role.create");

  return (
    <Dialog>
      <DialogTrigger render={<Button />}>
        <PlusIcon />
        {t("title")}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <CreateEditRoleAdmin />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
