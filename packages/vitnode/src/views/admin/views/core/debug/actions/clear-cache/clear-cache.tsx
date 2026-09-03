"use client";

import { BrushCleaningIcon } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { Button } from "@/components/ui/button";

export const ClearCacheAction = ({
  onClearCache,
}: {
  onClearCache: () => Promise<void>;
}) => {
  const t = useTranslations("admin.debug.actions.clear_cache");
  const tErrors = useTranslations("core.global.errors");

  return (
    <ConfirmActionAlertDialog
      description={t("desc")}
      onSubmit={async ({ onClose }) => {
        try {
          await onClearCache();
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
