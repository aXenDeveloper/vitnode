"use client";

import { ConfirmActionAlertDialog } from "@vitnode/core/components/confirm-action/confirm-action-alert-dialog";
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

import { mutationApi } from "./mutation-api";

export const DeleteAction = ({ title, id }: { id: number; title: string }) => {
  const t = useTranslations("@vitnode/blog.admin.categories.delete");
  const tGlobal = useTranslations("core.global");

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
          <TooltipTrigger asChild>
            <Button
              aria-label={t("title")}
              size="icon"
              variant="destructiveGhost"
            >
              <Trash2Icon className="size-4" />
            </Button>
          </TooltipTrigger>
        </ConfirmActionAlertDialog>

        <TooltipContent>{t("title")}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
