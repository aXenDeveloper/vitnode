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
import { PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import React from "react";

import { CONFIG_PLUGIN } from "@/const";

const CreateEditActionPostsAdmin = dynamic(async () =>
  import("../../actions/create-edit/create-edit").then(mod => ({
    default: mod.CreateEditActionPostsAdmin,
  })),
);

export const EditAction = (
  props: Required<React.ComponentProps<typeof CreateEditActionPostsAdmin>>,
) => {
  const t = useTranslations("@vitnode/blog.admin.posts.edit");
  const canEdit = useAdminStaffPermission({
    plugin: CONFIG_PLUGIN.pluginId,
    module: "posts",
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
          <DialogDescription>{props.data.title}</DialogDescription>
        </DialogHeader>

        <React.Suspense fallback={<Loader />}>
          <CreateEditActionPostsAdmin {...props} />
        </React.Suspense>
      </DialogContent>
    </Dialog>
  );
};
