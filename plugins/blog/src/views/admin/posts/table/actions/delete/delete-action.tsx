"use client";

import { ConfirmActionAlertDialog } from "@vitnode/core/components/confirm-action/confirm-action-alert-dialog";
import { useAdminStaffPermission } from "@vitnode/core/components/staff-permission/provider";
import { Button } from "@vitnode/core/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@vitnode/core/components/ui/tooltip";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { CONFIG_PLUGIN } from "@/const";

import { mutationApi } from "./mutation-api";

export const DeleteAction = ({ title, id }: { id: number; title: string }) => {
  const t = useTranslations("@vitnode/blog.admin.posts.delete");
  const tGlobal = useTranslations("core.global");
  const canDelete = useAdminStaffPermission({
    plugin: CONFIG_PLUGIN.pluginId,
    module: "posts",
    permission: "can_delete",
  });

  if (!canDelete) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <ConfirmActionAlertDialog
          description={t.rich("desc", {
            title: () => (
              <span className="text-foreground font-bold">{title}</span>
            ),
          })}
          onSubmit={async ({ onClose }) => {
            const mutation = await mutationApi(id);
            if (mutation?.error) {
              toast.error(tGlobal("errors.title"), {
                description: tGlobal("errors.internal_server_error"),
              });

              return;
            }

            toast.success(t("success"), {
              description: title,
            });
            onClose();
          }}
          textSubmit={t("confirm")}
          title={t("title")}
        >
          <TooltipTrigger
            render={
              <Button aria-label={t("title")} size="icon" variant="destructive">
                <Trash2Icon className="size-4" />
              </Button>
            }
          />
        </ConfirmActionAlertDialog>

        <TooltipContent>{t("title")}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
