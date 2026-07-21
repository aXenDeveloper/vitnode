"use client";

import { useAdminStaffPermission } from "@vitnode/core/components/staff-permission/provider";
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
import { getLangValue } from "@vitnode/core/lib/helpers/multi-lang";
import { PencilIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import React from "react";

import { CONFIG_PLUGIN } from "@/const";

const CreateEditActionCategoriesAdmin = dynamic(async () =>
  import("../..//actions/create-edit/create-edit").then(mod => ({
    default: mod.CreateEditActionCategoriesAdmin,
  })),
);

export const EditAction = (
  props: Required<React.ComponentProps<typeof CreateEditActionCategoriesAdmin>>,
) => {
  const t = useTranslations("@vitnode/blog.admin.categories.edit");
  const locale = useLocale();
  const canEdit = useAdminStaffPermission({
    plugin: CONFIG_PLUGIN.pluginId,
    module: "categories",
    permission: "can_edit",
  });

  if (!canEdit) return null;

  return (
    <Dialog>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger
            render={
              <DialogTrigger
                render={
                  <Button aria-label={t("title")} size="icon" variant="ghost" />
                }
              >
                <PencilIcon />
              </DialogTrigger>
            }
          />
          <TooltipContent>{t("title")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {getLangValue(props.data.titleTranslations, locale) ||
              props.data.titleTranslations[0]?.value}
          </DialogDescription>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <CreateEditActionCategoriesAdmin {...props} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
