"use client";

import { BrushCleaningIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { Button } from "@/components/ui/button";

import { clearCacheMutation } from "./mutation-api.server";

export const ClearCacheAction = () => {
  const t = useTranslations("admin.debug.actions.clear_cache");
  const tErrors = useTranslations("core.global.errors");

  return (
    <ConfirmActionAlertDialog
      description={t("desc")}
      onSubmit={async ({ onClose }) => {
        try {
          await clearCacheMutation();
        } catch {
          toast.error(tErrors("title"), {
            description: tErrors("internal_server_error"),
          });

          return;
        }

        onClose();
        toast.success(t("success"));
      }}
      textSubmit={t("confirm")}
      title={t("title")}
    >
      <Button>
        <BrushCleaningIcon />
        {t("label")}
      </Button>
    </ConfirmActionAlertDialog>
  );
};
