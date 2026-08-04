"use client";

import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ConfirmActionAlertDialog } from "@/components/confirm-action/confirm-action-alert-dialog";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/lib/navigation";

import { clearSearchCollectionMutation } from "./mutation-api.server";

/**
 * The only way to clear an orphaned collection, and deliberately not called
 * "reindex": nothing rebuilds these documents afterwards, because the plugin that
 * knew how to produce them is no longer registered.
 */
export const RemoveCollectionDocumentsAction = ({
  itemType,
  label,
}: {
  itemType: string;
  label: string;
}) => {
  const t = useTranslations("core.search.admin.collections");
  const router = useRouter();

  return (
    <ConfirmActionAlertDialog
      description={t("removeConfirmDescription")}
      onSubmit={async ({ onClose }) => {
        const result = await clearSearchCollectionMutation(itemType);

        if (result.error) {
          toast.error(t("removeError"), { description: label });

          return;
        }

        toast.success(t("removeSuccess", { collection: label }), {
          description: t("removeSuccessDesc"),
        });
        onClose();
        router.refresh();
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
