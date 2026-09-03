"use client";

import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { Button } from "@/components/ui/button";

import type { ClearSearchCollection } from "./search-index-mutations";

export const RemoveCollectionDocumentsAction = ({
  itemType,
  label,
  onClear,
}: {
  itemType: string;
  label: string;
  onClear: ClearSearchCollection;
}) => {
  const t = useTranslations("core.search.admin.collections");

  return (
    <ConfirmActionAlertDialog
      description={t("removeConfirmDescription")}
      onSubmit={async ({ onClose }) => {
        const result = await onClear(itemType);

        if (result.error) {
          toast.error(t("removeError"), { description: label });

          return;
        }

        toast.success(t("removeSuccess", { collection: label }), {
          description: t("removeSuccessDesc"),
        });
        onClose();
      }}
      submitVariant="destructive"
      textSubmit={t("removeDocuments")}
      title={t("removeConfirmTitle", { collection: label })}
    >
      <Button size="sm" variant="ghost">
        <Trash2Icon />
        {t("removeDocuments")}
      </Button>
    </ConfirmActionAlertDialog>
  );
};
