"use client";

import { Button } from "@vitnode/core/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@vitnode/core/components/ui/dialog";
import { Loader } from "@vitnode/core/components/ui/loader";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import React from "react";

const CreateEditActionPostsAdmin = dynamic(async () =>
  import("./create-edit/create-edit").then(module => ({
    default: module.CreateEditActionPostsAdmin,
  })),
);

export const ActionsPostsAdmin = () => {
  const t = useTranslations("@vitnode/blog.admin.posts.create");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon />
          {t("title")}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <CreateEditActionPostsAdmin />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
