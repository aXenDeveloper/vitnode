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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@vitnode/core/components/ui/tooltip";
import { PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import React from "react";

const CreateEditActionCategoriesAdmin = dynamic(async () =>
  import("../..//actions/create-edit/create-edit").then(mod => ({
    default: mod.CreateEditActionCategoriesAdmin,
  })),
);

export const EditAction = (
  props: Required<React.ComponentProps<typeof CreateEditActionCategoriesAdmin>>,
) => {
  const t = useTranslations("@vitnode/blog.admin.categories.edit");

  return (
    <Dialog>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button aria-label={t("title")} size="icon" variant="ghost">
                <PencilIcon />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>{t("title")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{props.data.title}</DialogDescription>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <CreateEditActionCategoriesAdmin {...props} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
